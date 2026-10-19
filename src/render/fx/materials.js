// FX materials: noise-shader flames, coal beds, glow halos, streaked embers, sky-lit smoke puffs.
// All are ShaderMaterials over InstanceBatch quads. Two variants:
//   SOFT_DEPTH=1 (post tiers): drawn after AO by FXPass, depth-tested in-shader against the scene depth
//                texture (soft intersection + occlusion), GL depth test off.
//   SOFT_DEPTH=0 (low tier):   drawn as a second scene render into the canvas with GL depth test.
//
// Units: emitters carry PHYSICAL luminance (cd/m²) / intensity (cd) per instance and are multiplied by uP
// (= env.preExposure × env.fireScale) like every other light in the scene (env contract, src/env/index.js).
// Emission is then soft-capped (uCap, display-referred) so a flame stays brighter than anything it lights
// without flooding bloom.
// Fog: env replaces three's fog chunks with aerial perspective applied inside tonemapping_fragment; FX use
// fog:false and apply their own: transmittance only for additive emitters, full blend for smoke.
import {
  ShaderMaterial, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, AddEquation,
  Vector2, Vector3, Vector4, Color,
} from 'three';

const COMMON = /* glsl */`
#include <packing>
uniform float uTime;
uniform float uP;
uniform float uCap;
uniform float uFireGain; // ≤ 1: eye adapted to the flames themselves (night), keeps core/body/tip contrast
uniform vec4 uFog;       // x mode (0 none, 1 linear, 2 exp2), y density, z near, w far
uniform vec3 uFogColor;
varying float vFxFog;
#ifdef SOFT_DEPTH
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform vec2 uNearFar;
float softFade(float fragViewZ, float softness) {
  float d = texture2D(uDepth, gl_FragCoord.xy / uResolution).x;
  float sceneZ = perspectiveDepthToViewZ(d, uNearFar.x, uNearFar.y);
  return clamp((fragViewZ - sceneZ) / softness, 0.0, 1.0);
}
#else
float softFade(float fragViewZ, float softness) { return 1.0; }
#endif
float fogAmount() {
  if (uFog.x > 1.5) return 1.0 - exp(-uFog.y * uFog.y * vFxFog * vFxFog);
  if (uFog.x > 0.5) return smoothstep(uFog.z, uFog.w, vFxFog);
  return 0.0;
}
// luminance-preserving soft cap of emission (keeps hue)
vec3 capEmission(vec3 c) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (y <= 1e-6) return c;
  return c * (uCap * (1.0 - exp(-y / uCap)) / y);
}
`;

const VCOMMON = /* glsl */`
uniform float uTime;
varying float vFxFog;
`;

const OUTPUT = /* glsl */`
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

function defines(soft, low) {
  const d = {};
  if (soft) d.SOFT_DEPTH = 1;
  if (low) d.LOW_Q = 1;
  // flame alpha edge: wider on low (rendered at 0.8 scale and upscaled => softer, unjagged tips)
  d.FLAME_EDGE = low ? '0.45' : '0.3';
  return d;
}

/**
 * Blending per tier. Flames are premultiplied (emission + soot absorption). Glows (halo, ember, coal bed) are
 * additive in the HDR buffer; on low they land in the 8-bit canvas already tone-mapped, where screen blending
 * (One, OneMinusSrcColor) saturates toward their colour instead of clipping to white.
 */
function setBlend(m, kind, low) {
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = OneFactor;
  if (kind === 'flame' || kind === 'smoke') m.blendDst = OneMinusSrcAlphaFactor;
  else m.blendDst = low ? OneMinusSrcColorFactor : OneFactor;
}

// ---------------------------------------------------------------- flames
const FLAME_VS = /* glsl */`
attribute vec3 iPos;      // flame base, world
attribute vec2 iSize;     // width, height (m)
attribute vec4 iParams;   // seed, fuel intensity 0..1, turbulence, speed
attribute vec4 iLean;     // tip lean (x, z) per metre of height; overlap emission scale; luminance cd/m²
varying vec2 vUv;
varying vec4 vParams;
varying float vEmit;
varying float vViewZ;
varying float vSoot;
${VCOMMON}
void main() {
  vUv = uv;
  vParams = iParams;
  vEmit = iLean.z * iLean.w;
  float seed = iParams.x;
  float inten = clamp(iParams.y, 0.0, 1.5);
  float t = uTime * iParams.w;
  // licking: the tongue stretches and shrinks; less fuel => smaller flames
  float lick = 1.0 + 0.13 * sin(t * 5.3 + seed * 31.0) + 0.07 * sin(t * 9.1 + seed * 17.0);
  float h = iSize.y * mix(1.0, lick, clamp(iParams.z, 0.0, 1.0)) * (0.3 + 0.7 * min(inten, 1.0));
  float w = iSize.x * (0.55 + 0.45 * min(inten, 1.0));
  // soot emissivity of a flame this thick (Beer–Lambert, κ ≈ 1.3 m⁻¹ for luminous wood flames):
  // a 1 m pyre tongue ≈ 0.7, a torch ≈ 0.2, an oil-lamp flame ≈ 0.04
  vSoot = 1.0 - exp(-1.3 * w);
  vec3 toCamH = cameraPosition - iPos; toCamH.y = 0.0;
  float lh = length(toCamH);
  vec3 dirC = lh > 1e-4 ? toCamH / lh : vec3(0.0, 0.0, 1.0);
  vec3 right = vec3(dirC.z, 0.0, -dirC.x);
  vec3 toCam = normalize(cameraPosition - iPos);
  vec3 sphUp = normalize(cross(toCam, right));
  // cylindrical billboard (stays vertical), leaning toward the camera when seen from above
  vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), sphUp, 0.6 * smoothstep(0.3, 0.95, toCam.y)));
  vec2 p = position.xy;
  vec3 lean = vec3(iLean.x, 0.0, iLean.y) * (p.y * p.y) * h;
  vec3 wp = iPos + right * (p.x * w) + up * (p.y * h) + lean;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FLAME_FS = /* glsl */`
uniform sampler2D uNoise;
varying vec2 vUv;
varying vec4 vParams;
varying float vEmit;
varying float vViewZ;
varying float vSoot;
${COMMON}
// dark red -> orange -> yellow-orange body -> pale yellow core (wood fire, ~1100–1900 K soot emission)
vec3 fireRamp(float h) {
  vec3 c = mix(vec3(0.20, 0.012, 0.0), vec3(0.95, 0.20, 0.015), smoothstep(0.0, 0.28, h));
  c = mix(c, vec3(1.0, 0.47, 0.07), smoothstep(0.22, 0.55, h));
  c = mix(c, vec3(1.0, 0.72, 0.32), smoothstep(0.55, 1.0, h));
  return c;
}
void main() {
  float seed = vParams.x;
  float inten = vParams.y;
  float turb = vParams.z;
  float t = uTime * vParams.w;
  vec2 uv = vUv;
  float y = uv.y;
  float n1 = texture2D(uNoise, vec2(uv.x * 0.32 + seed, y * 0.42 - t * 0.50)).r;
  float n2 = texture2D(uNoise, vec2(uv.x * 0.65 + seed * 1.37, y * 0.85 - t * 1.05)).g;
  float dx = ((n1 - 0.5) * 0.60 + (n2 - 0.5) * 0.28) * y * turb;
  float x = (uv.x - 0.5 + dx) * 2.0;
  float base = smoothstep(0.0, 0.18, y);
  float width = mix(0.22, 1.0, base) * pow(max(1.0 - y, 0.0), 0.6);
  float shape = 1.0 - abs(x) / max(width, 1e-3);
  float n3 = texture2D(uNoise, vec2(uv.x * 1.1 + seed * 2.1, y * 1.3 - t * 1.8)).b;
#ifdef LOW_Q
  float er = n3;
#else
  float n4 = texture2D(uNoise, vec2(uv.x * 1.6 - seed, y * 1.9 - t * 2.6)).a;
  float er = n3 * 0.74 + n4 * 0.26;
#endif
  float d = shape * 1.3 - er * (0.18 + 1.0 * y) * turb;
  d *= smoothstep(0.0, 0.06, y);
  if (d <= 0.0) discard;
  float a = smoothstep(0.0, FLAME_EDGE, d);
  float heat = clamp(d * (1.3 - 0.9 * y), 0.0, 1.0);
  // x luminance: body (heat 0.3–0.6) 0.45–0.7 L, core ≈ 1.25 L — a luminous wood flame outshines the day sky
  vec3 col = fireRamp(heat) * (0.35 + 0.9 * heat * heat) * a;
  col = capEmission(col * inten * vEmit * uP * uFireGain);
  float fade = softFade(vViewZ, 0.25) * (1.0 - fogAmount());
  col *= fade;
  // premultiplied: the sooty flame also hides part of what is behind it (its emissivity), so the sky cannot
  // tint it pink and overlapping tongues converge to the flame colour instead of summing to white
  gl_FragColor = vec4(col, vSoot * a * fade * min(inten, 1.0));
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- halos (glare around a fire; mostly low tier)
const HALO_VS = /* glsl */`
attribute vec3 iPos;     // glow centre
attribute vec4 iParams;  // radius, luminance (cd/m² at centre), seed, -
attribute vec3 iColor;
varying vec2 vUv;
varying vec3 vColor;
varying float vInten;
varying float vViewZ;
${VCOMMON}
void main() {
  vUv = uv;
  float r = iParams.x;
  float fl = 1.0 + 0.08 * sin(uTime * 6.1 + iParams.z * 21.0) + 0.05 * sin(uTime * 11.3 + iParams.z * 9.0);
  vInten = iParams.y * fl;
  vColor = iColor;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toCam = cameraPosition - iPos;
  float dist = length(toCam);
  // pull the sprite toward the viewer so nearby walls clip it less
  vec3 c = iPos + toCam / max(dist, 1e-3) * min(r * 0.7, dist * 0.5);
  vInten *= smoothstep(r * 1.2, r * 3.5, dist); // up close the sprite would intersect nearby surfaces
  vec2 p = position.xy;
  vec3 wp = c + (camRight * p.x + camUp * p.y) * r;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const HALO_FS = /* glsl */`
varying vec2 vUv;
varying vec3 vColor;
varying float vInten;
varying float vViewZ;
${COMMON}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 >= 1.0) discard;
  // pure exponential glare, reaching exactly zero at the sprite edge (no rim, no disc)
  float g = (exp(-r2 * 6.0) - 0.0024788) / 0.9975212;
  g = 0.4 * g + 0.6 * exp(-r2 * 30.0) * (1.0 - r2);
  vec3 col = capEmission(vColor * vInten * uP * uFireGain) * g;
  col *= softFade(vViewZ, 2.0) * (1.0 - fogAmount());
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- embers (analytic GPU particles, motion-streaked)
const EMBER_VS = /* glsl */`
attribute vec3 iPos;      // fire base
attribute vec4 iParams;   // seed, spread radius, rise height, luminance (cd/m²)
attribute vec2 iParams2;  // rate (1/s), size (m)
varying vec2 vUv;
varying float vBright;
varying float vLife;
varying float vViewZ;
${VCOMMON}
float hash(float n) { return fract(sin(n) * 43758.5453123); }
vec3 emberOffset(float life, float s, float spread, float rise, float t) {
  float a = hash(s * 7.13) * 6.2831853;
  float r = sqrt(hash(s * 3.71)) * spread;
  vec3 p = vec3(cos(a) * r, 0.0, sin(a) * r);
  p.y += rise * (0.75 * life + 0.25 * life * life) * (0.6 + 0.8 * hash(s * 2.9));
  float drift = rise * 0.28 * life;
  p.x += sin(t * 2.3 + hash(s * 1.91) * 6.28 + life * 7.0) * 0.30 * spread * life + (hash(s * 9.1) - 0.5) * drift;
  p.z += cos(t * 1.9 + hash(s * 5.17) * 6.28 + life * 6.0) * 0.30 * spread * life + (hash(s * 4.3) - 0.5) * drift;
  return p;
}
void main() {
  vUv = uv;
  float seed = iParams.x;
  float rate = iParams2.x;
  float cyc = uTime * rate + hash(seed) * 17.0;
  float life = fract(cyc);
  float s = seed + floor(cyc) * 13.37;
  float alive = step(hash(s * 2.7), 0.7);
  vec3 p0 = iPos + emberOffset(life, s, iParams.y, iParams.z, uTime);
  vec3 p1 = iPos + emberOffset(max(life - 0.022 * rate, 0.0), s, iParams.y, iParams.z, uTime - 0.022);
  vec3 axis = p0 - p1;
  float al = length(axis);
  vec3 ax = al > 1e-5 ? axis / al : vec3(0.0, 1.0, 0.0);
  float size = iParams2.y * (1.0 - 0.6 * life);
  vec3 toCam = normalize(cameraPosition - p0);
  vec3 side = cross(ax, toCam);
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
  vec2 q = position.xy; // x -0.5..0.5, y 0..1
  vec3 wp = mix(p1 - ax * size, p0 + ax * size, q.y) + side * q.x * 2.0 * size;
  float flick = 0.65 + 0.35 * sin(uTime * 23.0 + seed * 91.0);
  vBright = alive * iParams.w * pow(1.0 - life, 1.4) * flick * smoothstep(0.0, 0.05, life);
  vLife = life;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const EMBER_FS = /* glsl */`
varying vec2 vUv;
varying float vBright;
varying float vLife;
varying float vViewZ;
${COMMON}
void main() {
  if (vBright <= 1e-3) discard;
  float g = 1.0 - smoothstep(0.2, 1.0, abs(vUv.x * 2.0 - 1.0));
  vec3 c = mix(vec3(1.0, 0.55, 0.16), vec3(0.85, 0.11, 0.01), smoothstep(0.0, 0.7, vLife));
  vec3 col = capEmission(c * vBright * uP * uFireGain) * g;
  col *= softFade(vViewZ, 0.1) * (1.0 - fogAmount());
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- coal beds (glowing embers under the flames)
const BED_VS = /* glsl */`
attribute vec3 iPos;     // bed centre (fire base)
attribute vec4 iParams;  // radius, luminance (cd/m²), seed, -
varying vec2 vQ;
varying vec4 vParams;
varying float vViewZ;
${VCOMMON}
void main() {
  vQ = position.xy;
  vParams = iParams;
  vec3 wp = iPos + vec3(position.x * iParams.x, 0.04, -position.y * iParams.x);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const BED_FS = /* glsl */`
uniform sampler2D uNoise;
varying vec2 vQ;
varying vec4 vParams;
varying float vViewZ;
${COMMON}
void main() {
  float d2 = dot(vQ, vQ);
  if (d2 >= 1.0 || vParams.y <= 1e-3) discard;
  float seed = vParams.z;
  vec2 p = vQ * vParams.x; // metres
  float n1 = texture2D(uNoise, p * 0.55 + seed).a;
  float n2 = texture2D(uNoise, p * 0.23 + seed * 1.7).b;
  float n3 = texture2D(uNoise, p * 0.31 - vec2(0.0, uTime * 0.03) + seed).g;
  // cracked coal: bright seams between darker lumps, slowly breathing
  float seam = 1.0 - smoothstep(0.0, 0.16, abs(n1 - 0.5));
  float breathe = 0.65 + 0.35 * sin(uTime * (0.9 + n2) + n3 * 12.0);
  float heat = clamp(seam * 0.8 + n2 * 0.5 - 0.25, 0.0, 1.0) * breathe;
  heat *= pow(1.0 - d2, 1.2);
  vec3 c = mix(vec3(0.35, 0.03, 0.0), vec3(1.0, 0.30, 0.03), smoothstep(0.15, 0.7, heat));
  c = mix(c, vec3(1.0, 0.62, 0.22), smoothstep(0.75, 1.0, heat));
  vec3 col = capEmission(c * heat * vParams.y * uP * uFireGain);
  col *= softFade(vViewZ, 0.04) * (1.0 - fogAmount());
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- smoke (columns rising straight up)
const SMOKE_VS = /* glsl */`
attribute vec3 iPos;    // column base
attribute vec4 iCol;    // height, base width, density, seed
attribute vec4 iPuff;   // phase offset, kind (0 wood, 1 incense), rise speed (m/s), spread factor
attribute vec3 iGlow;   // fire beneath: colour × luminous intensity (cd, physical)
attribute vec2 iMisc;   // puffs in this column, -
varying vec2 vUv;
varying vec2 vShape;
varying float vAlpha;
varying float vH;
varying float vW;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vFwd;
varying float vViewZ;
varying float vSeed;
varying float vKind;
varying vec3 vGlow;
varying vec3 vWorld;
${VCOMMON}
void main() {
  float H = max(iCol.x, 0.1);
  float W = iCol.y;
  float seed = iCol.w;
  float N = max(iMisc.x, 1.0);
  float phase = fract(iPuff.x + uTime * iPuff.z / H);
  const float E = 0.9; // mild deceleration of the buoyant plume
  float h = H * pow(phase, E);
  float gap = H * E * pow(max(phase, 0.03), E - 1.0) / N; // distance to the next puff at this height
  float r = W * 0.5 * (1.0 + iPuff.w * pow(phase, 0.85));
  float rv = min(max(r, gap * 0.9), r * 2.2); // stretch along the column so neighbours overlap into one column
  vec3 c = iPos + vec3(0.0, h + rv * 0.5, 0.0);
  // internal churn only: the column axis itself never bends (Avot 5:5; Yoma 38a "rises like a stick")
  float ps = seed * 12.9 + iPuff.x * 40.0;
  c.x += sin(uTime * 0.55 + ps + phase * 8.0) * r * 0.08;
  c.z += cos(uTime * 0.47 + ps * 0.7 + phase * 7.0) * r * 0.08;
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toCam = normalize(cameraPosition - c);
  vec3 vu = vec3(0.0, 1.0, 0.0) - toCam * toCam.y;
  float lv = length(vu);
  vec3 axU = normalize(mix(camUp, vu / max(lv, 1e-4), smoothstep(0.05, 0.3, lv)));
  vec3 axR = normalize(cross(axU, toCam));
  float ang = iPuff.x * 37.0 + uTime * 0.05 * (fract(iPuff.x * 7.0) > 0.5 ? 1.0 : -1.0);
  float ca = cos(ang), sa = sin(ang);
  vec2 q = position.xy;
  vShape = q;
  vUv = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y) * vec2(1.0, rv / r);
  vRight = axR; vUp = axU; vFwd = toCam;
  float a = iCol.z;
  a *= smoothstep(0.0, 0.025, phase) * (1.0 - smoothstep(0.45, 1.0, phase));
  a *= pow(clamp(W * 0.5 / r, 0.0, 1.0), 0.7);
  a *= mix(1.0, 0.6, clamp((rv / r - 1.0) * 0.5, 0.0, 1.0)); // stretched puffs overlap more
  float dist = length(cameraPosition - c);
  a *= smoothstep(r * 0.6, r * 2.2, dist); // avoid full-screen overdraw when the viewer stands in the column
  vAlpha = a;
  vH = h + rv * 0.5;
  vW = W;
  vSeed = seed + iPuff.x;
  vKind = iPuff.y;
  vGlow = iGlow;
  vec3 wp = c + axR * (q.x * r) + axU * (q.y * rv);
  vWorld = wp;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const SMOKE_FS = /* glsl */`
uniform sampler2D uNoise;
uniform vec3 uSunDir;
uniform vec3 uSunColor;   // key light irradiance, scene units
uniform vec3 uSky;        // sky radiance from above, scene units
uniform vec3 uGround;     // bounce radiance from below, scene units
varying vec2 vUv;
varying vec2 vShape;
varying float vAlpha;
varying float vH;
varying float vW;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vFwd;
varying float vViewZ;
varying float vSeed;
varying float vKind;
varying vec3 vGlow;
varying vec3 vWorld;
${COMMON}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
void main() {
  vec2 p = vShape;
  float r2 = dot(p, p);
  if (r2 >= 1.0 || vAlpha <= 0.002) discard;
  vec2 nuv = vUv * 0.28 + vec2(vSeed * 0.37, vSeed * 0.71 - uTime * 0.015);
  float n = texture2D(uNoise, nuv).g;
#ifdef LOW_Q
  const float NAMP = 0.7; // one octave only: a gentler erosion keeps puffs round instead of torn strips
#else
  const float NAMP = 1.1;
  n = n * 0.6 + texture2D(uNoise, nuv * 2.1 + 0.3).b * 0.4;
#endif
  float body = 1.0 - r2;
  float dens = smoothstep(0.08, 0.8, body * 0.9 + (n - 0.5) * NAMP);
  float a = vAlpha * dens;
  if (a <= 0.002) discard;
  vec3 nrm = normalize(vRight * p.x + vUp * p.y + vFwd * sqrt(max(1.0 - r2, 0.0)));
  vec3 albedo = mix(vec3(0.50, 0.48, 0.46), vec3(0.80, 0.82, 0.86), vKind);
  vec3 V = normalize(vWorld - cameraPosition);
  // key light (sun or moon): wrapped diffuse (multiple scattering) + forward scattering when backlit
  float ws = clamp(dot(nrm, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 direct = uSunColor * (ws * 0.318 + hg(dot(V, uSunDir), 0.55) * 1.6 * (1.0 - dens * 0.6));
  vec3 amb = mix(uGround, uSky, nrm.y * 0.5 + 0.5);
  // the fire below lights the column from underneath: inverse square from the flames (physical cd × uP)
  float hb = vH + vW;
  vec3 glowE = vGlow * uP / (hb * hb);
  vec3 glow = glowE * 0.318 * (0.35 + 0.65 * clamp(0.3 - nrm.y, 0.0, 1.0));
  vec3 col = albedo * (direct + amb + glow);
  float f = fogAmount();
  col = mix(col, uFogColor, f);
  a *= softFade(vViewZ, 1.5);
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}
`;

/**
 * Create the FX materials. `shared` uniforms (time, noise, depth, exposure, fog) are shared by reference.
 */
export function createFxMaterials({ soft, low, noise }) {
  const shared = {
    uTime: { value: 0 },
    uNoise: { value: noise },
    uDepth: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uNearFar: { value: new Vector2(0.1, 1000) },
    uP: { value: 3e-5 },
    uCap: { value: 24 },
    uFireGain: { value: 1 },
    uFog: { value: new Vector4(0, 0, 0, 1) },
    uFogColor: { value: new Color(0, 0, 0) },
  };
  const def = defines(soft, low);
  const common = { defines: def, transparent: true, depthWrite: false, depthTest: !soft, fog: false };
  const make = (name, kind, vs, fs, extra = {}) => {
    const m = new ShaderMaterial({ ...common, name, uniforms: { ...shared, ...extra }, vertexShader: vs, fragmentShader: fs });
    m.userData.fxKind = kind;
    setBlend(m, kind, low);
    return m;
  };
  const flame = make('fx.flame', 'flame', FLAME_VS, FLAME_FS);
  const halo = make('fx.halo', 'halo', HALO_VS, HALO_FS);
  const ember = make('fx.ember', 'ember', EMBER_VS, EMBER_FS);
  const bed = make('fx.bed', 'bed', BED_VS, BED_FS);
  const smoke = make('fx.smoke', 'smoke', SMOKE_VS, SMOKE_FS, {
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color(0, 0, 0) },
    uSky: { value: new Color(0.1, 0.12, 0.15) },
    uGround: { value: new Color(0.04, 0.04, 0.04) },
  });
  return { shared, flame, halo, ember, smoke, bed };
}

/** Switch soft-depth / quality defines (tier change) and recompile. */
export function setFxMaterialMode(mats, { soft, low }) {
  for (const m of [mats.flame, mats.halo, mats.ember, mats.smoke, mats.bed]) {
    m.defines = defines(soft, low);
    m.depthTest = !soft;
    setBlend(m, m.userData.fxKind, low);
    m.needsUpdate = true;
  }
}

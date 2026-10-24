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
  ShaderMaterial, CustomBlending, OneFactor, ZeroFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, AddEquation,
  Vector2, Vector3, Vector4, Color, FrontSide, BackSide,
} from 'three';

const COMMON = /* glsl */`
#include <packing>
uniform float uTime;
uniform float uP;
uniform float uCap;
uniform float uFireGain; // ≤ 1: eye adapted to the flames themselves (night), keeps core/body/tip contrast
uniform vec3 uWB;        // env's white-balance gains (chromatic adaptation to a room's light), undone for emitters
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
// luminance-preserving soft cap of emission (keeps hue). render-env-2: the room's chromatic adaptation (env
// whiteBalance, applied to the whole frame at tone mapping) is mostly undone for the flames, embers and coal beds —
// the eye adapts locally to a bright source and sees it in its own colour; the flame ramp is paler than the fires'
// light colour, so a correction toward that light turned the hearth's flames blue-white
vec3 capEmission(vec3 c) {
  c /= mix(vec3(1.0), max(uWB, vec3(0.05)), 0.85);
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
  if (kind === 'flame' || kind === 'smoke' || (kind === 'bed' && !low)) m.blendDst = OneMinusSrcAlphaFactor;
  else m.blendDst = low ? OneMinusSrcColorFactor : OneFactor;
  // qa-r2-fix-env-render: the buffer's alpha becomes an EMITTER MASK on the post tiers (FXPass sets it to 1 first):
  // flames, embers, glows and glints multiply it by (1 − their coverage), the shader's alpha (the flame's emissivity, a
  // glow's shape); smoke and the coal-bed decal leave it. The grade pass reads it: no heat shimmer on a flame's own pixels,
  // and at night the bloom keeps its glare for the emitters, not for the surfaces they light (post-effects.js)
  m.blendEquationAlpha = AddEquation;
  m.blendSrcAlpha = ZeroFactor;
  m.blendDstAlpha = kind === 'smoke' || kind === 'bed' ? OneFactor : OneMinusSrcAlphaFactor;
  // the bed is a box: a decal drawn by its far faces on the post tiers (the camera may stand inside it), flattened into
  // a disc seen from above on low
  if (kind === 'bed') m.side = low ? FrontSide : BackSide;
}

// ---------------------------------------------------------------- flames
// qa-r1-fix-env-render: soft-edged procedural flipbook cards. Each card is a plume envelope eroded by noise that rises
// faster with height (the licks tear off and burn out at the top), drawn as two layers in one premultiplied output:
//   body  emission × visible density, alpha = its emissivity (Kirchhoff: a sooty flame hides what is behind it as much
//         as it emits), thinning to nothing at the edges — the path through a round flame there is short — so no dark
//         paper-cut rim can form where the emission fades before the alpha;
//   core  the hot core added on top (alpha 0): brighter than daylit stone, pale yellow.
// The base fades in over the fuel and, on the post tiers, against the scene depth (the logs), never a hard cut.
const FLAME_VS = /* glsl */`
attribute vec3 iPos;      // flame base, world
attribute vec2 iSize;     // width, height (m)
attribute vec4 iParams;   // seed, fuel intensity 0..1, turbulence, speed
attribute vec4 iLean;     // tip lean (x, z) per metre of height; overlap emission scale; luminance cd/m²
attribute float iCore;    // the hot core's added emission at its peak (× luminance)
varying vec2 vUv;
varying vec4 vParams;
varying float vEmit;
varying float vViewZ;
varying float vSoot;
varying vec2 vSize;
varying float vCore;
varying float vGraze;
${VCOMMON}
void main() {
  vUv = uv;
  vParams = iParams;
  vEmit = iLean.z * iLean.w;
  vCore = iCore;
  float seed = iParams.x;
  float inten = clamp(iParams.y, 0.0, 1.5);
  float t = uTime * iParams.w;
  // licking: the whole card stretches and shrinks a little; less fuel => smaller flames
  float lick = 1.0 + 0.09 * sin(t * 4.1 + seed * 31.0) + 0.05 * sin(t * 7.3 + seed * 17.0);
  float h = iSize.y * mix(1.0, lick, clamp(iParams.z, 0.0, 1.0)) * (0.3 + 0.7 * min(inten, 1.0));
  float w = iSize.x * (0.55 + 0.45 * min(inten, 1.0));
  vSize = vec2(w, h);
  // soot emissivity of a flame this thick (Beer–Lambert, κ ≈ 1.1 m⁻¹ for luminous wood flames): a 1 m pyre card ≈ 0.6,
  // a torch ≈ 0.2, an oil-lamp flame ≈ 0.04
  vSoot = 1.0 - exp(-1.1 * w);
  vec3 toCamH = cameraPosition - iPos; toCamH.y = 0.0;
  float lh = length(toCamH);
  vec3 dirC = lh > 1e-4 ? toCamH / lh : vec3(0.0, 0.0, 1.0);
  vec3 right = vec3(dirC.z, 0.0, -dirC.x);
  vec3 toCam = normalize(cameraPosition - iPos);
  vec3 sphUp = normalize(cross(toCam, right));
  // cylindrical billboard (stays vertical), leaning toward the camera when seen from well above or below
  // (qa-r2-fix-env-render: from below too — the altar's fire from its foot)
  vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), sphUp, 0.6 * smoothstep(0.3, 0.95, abs(toCam.y))));
  // a card seen within ≈ 25° of its own plane is a smear, not a flame: faded out (it cannot happen with the lean above
  // short of looking straight up or down the axis, but the cards' feet sit close to the viewer on the altar's top)
  vGraze = smoothstep(0.2, 0.42, abs(dot(normalize(cross(right, up)), toCam)));
  vec2 p = position.xy;
  vec3 lean = vec3(iLean.x, 0.0, iLean.y) * (p.y * p.y) * h;
  // the card's foot sits a little into the fuel: its fade-in hides the cut
  vec3 wp = iPos + right * (p.x * w) + up * (p.y * h - 0.06 * h) + lean;
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
varying vec2 vSize;
varying float vCore;
varying float vGraze;
${COMMON}
// deep red -> orange -> yellow-orange body -> pale yellow (wood-fire soot, ≈ 1100–1650 K, partly white-balanced)
vec3 fireRamp(float T) {
  vec3 c = mix(vec3(0.7, 0.1, 0.008), vec3(1.0, 0.3, 0.03), smoothstep(0.0, 0.35, T));
  c = mix(c, vec3(1.0, 0.52, 0.1), smoothstep(0.3, 0.7, T));
  c = mix(c, vec3(1.0, 0.74, 0.38), smoothstep(0.72, 1.0, T));
  return c;
}
void main() {
  float seed = vParams.x;
  float inten = vParams.y;
  float turb = vParams.z;
  float t = uTime * vParams.w;
  float y = vUv.y;
  // the card's height in pixels (before any branch: ANGLE/D3D11): the finest erosion fades out where its cells fall
  // under a few pixels — at 25 m the great pile's flames are ≈ 60 px tall and that detail only shredded them
  float hPx = 1.0 / max(fwidth(y), 1e-4);
  // card coordinates in flame heights (isotropic noise whatever the card's aspect)
  float sc = 1.0 / max(vSize.y, 0.02);
  float mx = (vUv.x - 0.5) * vSize.x * sc;
  // big slow licks (domain warp), growing with height
  float w1 = texture2D(uNoise, vec2(mx * 0.42 + seed, y * 0.36 - t * 0.55)).r;
  float w2 = texture2D(uNoise, vec2(mx * 0.85 - seed * 1.3, y * 0.72 - t * 0.95)).g;
  float warp = ((w1 - 0.5) * 0.9 + (w2 - 0.5) * 0.4) * turb * (0.1 + 0.8 * y);
  float x = (vUv.x - 0.5) * 2.0 + warp;
  // the plume's envelope: full width over the fuel, tapering to rounded tips (no threads)
  float halfW = mix(1.0, 0.3, pow(y, 0.9)) * (0.8 + 0.2 * smoothstep(0.0, 0.2, y));
  float body = 1.0 - abs(x) / halfW;
  // erosion rising faster than the gas below it: tongues tear off and burn out
  float ex = x * 0.5 * vSize.x * sc;
  // qa-r2-fix-env-render: the tongues ≈ 6 noise cells per flame height (a wide pile breaks into a few tongues, not into
  // a dozen fragments: at 17 cells per height the great pile read as a shredded orange sheet), the 17-cell layer only
  // frays their edges, faded by its cells' pixel size
  float e1 = texture2D(uNoise, vec2(ex * 0.72 + seed * 2.1, y * 0.78 - t * 1.05)).g;
#ifdef LOW_Q
  float er = e1;
#else
  float e2 = texture2D(uNoise, vec2(ex * 1.05 - seed, y * 1.15 - t * 1.55)).b;
  float er = mix(e1, e2, 0.34 * smoothstep(2.0, 6.0, hPx / 17.0));
#endif
  float d = body * 1.15 - (er - 0.32) * (0.3 + 1.1 * y) * turb - 0.4 * y * y;
  d *= smoothstep(0.0, 0.1, y);
  if (d <= 0.0) discard;
  // visible density: a wide soft edge band (no cut-out rim)
  float dens = smoothstep(0.0, 0.5, d);
  // the path through a round flame is short at its edge: emission and emissivity thin out together there
  float thick = sqrt(clamp(body, 0.0, 1.0));
  // temperature: hottest low on the axis, cooling outward and upward — and, in the intermittent upper flame, still
  // yellow inside each tongue (its soot glows; only the tongue's skin is orange-red): the old ramp left the whole upper
  // half orange, so from below the altar's edge, where only that half shows, the fire had no hot centre at all
  float T = clamp(d * (1.15 - 0.65 * y) + 0.3 * y * smoothstep(0.35, 0.9, d) * thick, 0.0, 1.0);
  float vis = dens * mix(0.4, 1.0, thick);
  vec3 col = fireRamp(T) * (0.35 + 0.8 * T) * vis;
  // the hot core: an additive layer that does not hide anything (brighter than sunlit stone at noon), pale yellow-white
  col += vec3(1.0, 0.88, 0.64) * (smoothstep(0.6, 1.0, T) * dens * vCore);
  col = capEmission(col * inten * vEmit * uP * uFireGain);
  float softness = clamp(0.18 * vSize.x, 0.06, 0.45);
  float fade = softFade(vViewZ, softness) * (1.0 - fogAmount()) * vGraze;
  col *= fade;
  // premultiplied: the sooty body also hides part of what is behind it (its emissivity), so overlapping cards converge
  // to the flame colour instead of summing to white, and the sky cannot tint the flame pink
  // the cool, thin margins (T → 0) hold little soot: they barely hide the background (no dark rim on a sunlit wall)
  float occ = vSoot * vis * mix(0.5, 1.0, thick) * (0.3 + 0.7 * smoothstep(0.0, 0.35, T));
  float aOut = occ * fade * min(inten, 1.0);
#ifndef LOW_Q
  // qa-r2-fix-env-render: the alpha is also the emitter mask (setBlend). A lamp's or a torch's thin flame holds almost no
  // soot (emissivity ≈ 0.04) and would not mark it: its hot core counts at 0.4 at least — behind a core this bright the
  // extra occlusion cannot be seen
  aOut = max(aOut, 0.4 * smoothstep(0.5, 0.85, T) * dens * fade * min(inten, 1.0));
#endif
#ifdef LOW_Q
  // low draws into the tone-mapped 8-bit canvas: tone-map the flame's own colour per unit of its coverage, then apply
  // the coverage again — tone-mapping the premultiplied colour darkened the thin margins into an inked outline
  float cov = max(aOut, 0.15);
  gl_FragColor = vec4(col / cov, 1.0);
  ${OUTPUT}
  gl_FragColor = vec4(gl_FragColor.rgb * cov, aOut);
#else
  gl_FragColor = vec4(col, aOut);
  ${OUTPUT}
#endif
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
  float hv = softFade(vViewZ, 2.0) * (1.0 - fogAmount());
  vec3 col = capEmission(vColor * vInten * uP * uFireGain) * g * hv;
  gl_FragColor = vec4(col, clamp(2.0 * g * hv, 0.0, 1.0)); // alpha: emitter coverage (setBlend)
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- glints (render-env-2-fix)
// A mirror-polished convex body (Helena's nivreshet) returns the Sun as point sources of intensity E·F·R1R2/4 from tiny
// spots (the Sun's image on a lobe is ~1 mm: far below a pixel, so the surface shader cannot show it). Each spark is that
// flux, deposited into a Gaussian of uGlint.y px at its mirror point (fx/glint.js computes the peak in scene units),
// with the eye's own near glare round it (the bloom's kernel is too wide for a point at this scale).
const GLINT_VS = /* glsl */`
attribute vec3 iPos;      // world: the mirror point, pulled toward the viewer past the body's own surface
attribute vec3 iCol;      // the core's peak radiance (scene units, rgb)
uniform vec4 uGlint;      // x sprite half-size (px), y core sigma (px), zw the target's size (px)
varying vec2 vPx;
varying vec3 vCol;
varying float vViewZ;
${VCOMMON}
void main() {
  vCol = iCol;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  vec4 clip = projectionMatrix * mv;
  vPx = position.xy * uGlint.x;
  clip.xy += position.xy * uGlint.x * 2.0 / max(uGlint.zw, vec2(1.0)) * clip.w;
  gl_Position = clip;
}
`;

const GLINT_FS = /* glsl */`
uniform vec4 uGlint;
uniform vec4 uGlint2;     // x the core's footprint 2πσ²·Ω_px (sr): peak × x = the spark's illuminance at the eye; y deg per px
varying vec2 vPx;
varying vec3 vCol;
varying float vViewZ;
${COMMON}
void main() {
  float r = length(vPx);
  float r2 = r * r / (uGlint.y * uGlint.y);
  // the eye's own glare round a point source (CIE 2002 disability glare, young eye: L / E = 10 / θ³ + 5 / θ², θ in degrees),
  // 0.1–1.5°; the bloom's kernel is far wider than these few pixels. Its ≈ 17 % of the flux is taken from the core.
  float th = max(r * uGlint2.y, 0.1);
  float glare = (10.0 / (th * th * th) + 5.0 / (th * th)) * uGlint2.x * (1.0 - smoothstep(1.0, 1.5, th));
  float gv = softFade(vViewZ, 0.05) * (1.0 - fogAmount());
  vec3 col = vCol * (0.83 * exp(-0.5 * r2) + glare) * gv;
  gl_FragColor = vec4(col, exp(-0.5 * r2) * gv); // alpha: emitter coverage (setBlend)
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
  float ev = softFade(vViewZ, 0.1) * (1.0 - fogAmount());
  vec3 col = capEmission(c * vBright * uP * uFireGain) * g * ev;
  gl_FragColor = vec4(col, g * ev); // alpha: emitter coverage (setBlend)
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- coal beds (glowing embers under the flames)
// qa-r1-fix-env-render: on the post tiers a deferred decal — a box round the fuel bed; each pixel reconstructs the scene
// surface from the depth texture and, inside the bed's cylinder, chars it and lets it glow in cracked seams: the coal
// bed, the logs' tops and inner ends, the ash round them, whatever geometry the builders put there. Up-facing surfaces
// under the flames glow most (from the depth's derivatives). On low (no depth texture) the box flattens into the old
// disc at the top of the fuel bed.
const BED_VS = /* glsl */`
attribute vec3 iPos;     // bed centre (fire base: the top of the fuel bed)
attribute vec4 iParams;  // radius (m), luminance (cd/m²), seed, height of the bed's volume (m)
attribute vec2 iChar;    // the char's reach ÷ radius (≤ 1: none beyond the bed), the floor's ash darkening there
varying vec4 vParams;
varying float vViewZ;
#ifdef SOFT_DEPTH
varying vec3 vWorld;
varying vec3 vBase;
varying vec2 vChar;
#else
varying vec2 vQ;
#endif
${VCOMMON}
void main() {
  vParams = iParams;
#ifdef SOFT_DEPTH
  vBase = iPos;
  vChar = iChar;
  float H = max(iParams.w, 0.05);
  float Rb = iParams.x * max(iChar.x, 1.0);
  // from below the fuel's top (the coals and the ash under the pile) up through the logs, as far out as the char reaches
  vec3 wp = iPos + vec3(position.x * Rb, mix(-0.55 * H, H, position.y * 0.5 + 0.5), position.z * Rb);
  vWorld = wp;
#else
  vQ = position.xz;
  vec3 wp = iPos + vec3(position.x * iParams.x, 0.04, position.z * iParams.x);
#endif
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = mv.z;
  vFxFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const BED_FS = /* glsl */`
uniform sampler2D uNoise;
varying vec4 vParams;
varying float vViewZ;
#ifdef SOFT_DEPTH
varying vec3 vWorld;
varying vec3 vBase;
varying vec2 vChar;
#else
varying vec2 vQ;
#endif
${COMMON}
vec3 emberRamp(float heat) {
  vec3 c = mix(vec3(0.35, 0.03, 0.0), vec3(1.0, 0.30, 0.03), smoothstep(0.15, 0.7, heat));
  return mix(c, vec3(1.0, 0.62, 0.22), smoothstep(0.75, 1.0, heat));
}
void main() {
  float seed = vParams.z;
#ifdef SOFT_DEPTH
  // the scene surface on this pixel's ray (the box itself only selects the pixels)
  float dz = texture2D(uDepth, gl_FragCoord.xy / uResolution).x;
  float sceneZ = perspectiveDepthToViewZ(dz, uNearFar.x, uNearFar.y);
  vec3 P = cameraPosition + (vWorld - cameraPosition) * (sceneZ / min(vViewZ, -1e-4));
  // its facing, from the depth's screen derivatives (taken before any branch: ANGLE/D3D11)
  vec3 N = normalize(cross(dFdx(P), dFdy(P)) + vec3(0.0, 1e-6, 0.0));
  vec3 L = P - vBase;
  float R = max(vParams.x, 0.02), H = max(vParams.w, 0.05);
  float r = length(L.xz) / R;
  float h = L.y / H;
  float m = (1.0 - smoothstep(0.55, 1.0, r)) * smoothstep(-0.55, -0.2, h) * (1.0 - smoothstep(0.45, 1.0, h));
  // qa-r2-fix-env-render (ENV-R2-5): beyond the bed (a hearth's iChar.x > 1): the logs' charred outer lengths and the
  // ash and soot strewn round the kerb on the floor
  float rc = length(L.xz) / (R * max(vChar.x, 1.0));
  float mc = step(1.001, vChar.x) * (1.0 - smoothstep(0.7, 1.0, rc)) * smoothstep(-0.55, -0.4, h) * (1.0 - smoothstep(0.6, 1.0, h));
  if (max(m, mc) <= 1e-3 || vParams.y <= 1e-3) discard;
  float n1 = texture2D(uNoise, P.xz * 0.8 + seed).a;
  float n2 = texture2D(uNoise, vec2(P.x + P.z, P.y) * 0.75 + seed * 1.7).b;
  float n3 = texture2D(uNoise, P.xz * 0.3 + vec2(0.0, uTime * 0.03) + seed).g;
  // cracked char: glowing seams between the scales, slowly breathing
  float seam = 1.0 - smoothstep(0.0, 0.17, abs(mix(n1, n2, 0.4) - 0.5));
  float breathe = 0.6 + 0.4 * sin(uTime * (0.8 + n3) + n3 * 11.0);
  float top = smoothstep(-0.25, 0.65, N.y);                                     // log tops, the bed under the flames
  float hot = (1.0 - smoothstep(0.0, 0.85, r)) * (1.0 - smoothstep(0.35, 1.0, h)); // under and among the flames' foot
  float heat = clamp(seam * (0.5 + 0.5 * top) * (0.6 + 0.4 * hot) + hot * (0.3 + 0.55 * n3) - 0.18, 0.0, 1.0) * breathe * m;
  // above the floor (the logs, the kerb's top) vs the floor itself (1.0 − h ≈ the fire base's height over the floor)
  float logs = smoothstep(-0.38, -0.28, h);
  // the logs smoulder in their cracks toward the fire (dull red, fading out along them)
  heat = max(heat, seam * logs * top * (1.0 - smoothstep(0.2, 0.7, rc)) * 0.3 * breathe * mc);
  vec3 col = capEmission(emberRamp(heat) * heat * vParams.y * uP * uFireGain) * (1.0 - fogAmount());
  // char: what does not glow round the flames' foot is blackened (premultiplied: alpha darkens the surface)
  float charA = m * 0.85 * (1.0 - smoothstep(0.05, 0.55, heat)) * (1.0 - smoothstep(0.2, 0.95, r));
  // …and beyond it the logs are charred black, the floor round the kerb greyed by ash (vChar.y), both mottled
  // (sides — the kerb's outer face, the logs' flanks — take less soot than the tops)
  charA = max(charA, mc * mix(vChar.y * (0.75 + 0.5 * n2), (0.82 + 0.1 * n1) * mix(0.55, 1.0, top), logs) * (1.0 - smoothstep(0.05, 0.4, heat)));
  gl_FragColor = vec4(col, charA);
#else
  float d2 = dot(vQ, vQ);
  if (d2 >= 1.0 || vParams.y <= 1e-3) discard;
  vec2 p = vQ * vParams.x; // metres
  float n1 = texture2D(uNoise, p * 0.55 + seed).a;
  float n2 = texture2D(uNoise, p * 0.23 + seed * 1.7).b;
  float n3 = texture2D(uNoise, p * 0.31 - vec2(0.0, uTime * 0.03) + seed).g;
  // cracked coal: bright seams between darker lumps, slowly breathing
  float seam = 1.0 - smoothstep(0.0, 0.16, abs(n1 - 0.5));
  float breathe = 0.65 + 0.35 * sin(uTime * (0.9 + n2) + n3 * 12.0);
  float heat = clamp(seam * 0.8 + n2 * 0.5 - 0.25, 0.0, 1.0) * breathe;
  heat *= pow(1.0 - d2, 1.2);
  vec3 col = capEmission(emberRamp(heat) * heat * vParams.y * uP * uFireGain);
  col *= (1.0 - fogAmount());
  gl_FragColor = vec4(col, 1.0);
#endif
  ${OUTPUT}
}
`;

// ---------------------------------------------------------------- smoke (columns rising straight up)
// qa-r1-fix-env-render: the column starts thin and faint at the flame tips (a smoke base: hot gas, little soot yet) and
// widens and thickens as it rises and cools; inside, the puffs' surfaces roll (domain-warped noise with its own
// motion) and are lit as billows. The fire lights it from below only near the fire: its light reaches a height h through
// the column's own smoke beneath (exp(−τ), τ ∝ density × h / width) and falls off as the inverse square. The column
// axis never bends (Avot 5:5; Yoma 38a).
const SMOKE_VS = /* glsl */`
attribute vec3 iPos;    // column base
attribute vec4 iCol;    // height, base width, density, seed
attribute vec4 iPuff;   // phase offset, kind (0 wood, 1 incense), rise speed (m/s), spread factor
attribute vec3 iGlow;   // fire beneath: colour × luminous intensity (cd, physical)
attribute vec2 iMisc;   // puffs in this column, height of the column's base above iPos (m: the flame tips)
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
varying vec2 vCol2;     // the column's base height above the fire (m), its density
${VCOMMON}
void main() {
  float H = max(iCol.x, 0.1);
  float W = iCol.y;
  float seed = iCol.w;
  float N = max(iMisc.x, 1.0);
  float h0 = iMisc.y;
  float phase = fract(iPuff.x + uTime * iPuff.z / H);
  const float E = 0.9; // mild deceleration of the buoyant plume
  float h = H * pow(phase, E);
  float gap = H * E * pow(max(phase, 0.03), E - 1.0) / N; // distance to the next puff at this height
  // a narrow base (a third of the width) entraining air: the plume widens with height
  float r = W * 0.5 * (0.35 + 0.65 * smoothstep(0.0, 0.14, phase) + iPuff.w * pow(phase, 0.85));
  float rv = min(max(r, gap * 0.9), r * 2.2); // stretch along the column so neighbours overlap into one column
  vec3 c = iPos + vec3(0.0, h0 + h + rv * 0.5, 0.0);
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
  // faint at the base, thickening as it cools over the first fifth of the column, thinning out at the top
  a *= smoothstep(0.0, 0.2, phase) * (1.0 - smoothstep(0.45, 1.0, phase));
  a *= pow(clamp(W * 0.5 / r, 0.0, 1.0), 0.45);
  a *= mix(1.0, 0.6, clamp((rv / r - 1.0) * 0.5, 0.0, 1.0)); // stretched puffs overlap more
  float dist = length(cameraPosition - c);
  a *= smoothstep(r * 0.6, r * 2.2, dist); // avoid full-screen overdraw when the viewer stands in the column
  vAlpha = a;
  vH = h0 + h + rv * 0.5;
  vW = W;
  vCol2 = vec2(h0, iCol.z);
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
varying vec2 vCol2;
${COMMON}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
void main() {
  vec2 p = vShape;
  float r2 = dot(p, p);
  if (r2 >= 1.0 || vAlpha <= 0.002) discard;
  // billows: the puff's surface rolls (a domain warp with its own slow motion), then one or two octaves of detail
  vec2 nuv = vUv * 0.28 + vec2(vSeed * 0.37, vSeed * 0.71);
  vec2 wv = texture2D(uNoise, nuv * 0.55 + vec2(uTime * 0.011, -uTime * 0.019)).rg - 0.5;
  nuv += wv * 0.4 - vec2(0.0, uTime * 0.015);
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
  // the billow's own relief tilts the normal: lit tops, shaded undersides
  vec3 nrm = normalize(vRight * (p.x + wv.x * 0.9) + vUp * (p.y + wv.y * 0.9) + vFwd * sqrt(max(1.0 - r2, 0.0)));
  vec3 albedo = mix(vec3(0.50, 0.48, 0.46), vec3(0.80, 0.82, 0.86), vKind);
  vec3 V = normalize(vWorld - cameraPosition);
  // key light (sun or moon): wrapped diffuse (multiple scattering) + forward scattering when backlit
  float ws = clamp(dot(nrm, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 direct = uSunColor * (ws * 0.318 + hg(dot(V, uSunDir), 0.55) * 1.6 * (1.0 - dens * 0.6));
  vec3 amb = mix(uGround, uSky, nrm.y * 0.5 + 0.5);
  // the fire below lights the column from underneath: inverse square from the flames (physical cd × uP), through the
  // column's own smoke beneath this height — so only its foot glows
  float hb = vH + vW;
  float tau = 0.6 * vCol2.y * max(vH - vCol2.x, 0.0) / max(vW, 0.1);
  vec3 glowE = vGlow * uP * exp(-tau) / (hb * hb);
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
    uWB: { value: new Vector3(1, 1, 1) },
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
  const glint = make('fx.glint', 'glint', GLINT_VS, GLINT_FS, { uGlint: { value: new Vector4(4, 0.7, 1, 1) }, uGlint2: { value: new Vector4(0, 0.1, 0, 0) } });
  const smoke = make('fx.smoke', 'smoke', SMOKE_VS, SMOKE_FS, {
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color(0, 0, 0) },
    uSky: { value: new Color(0.1, 0.12, 0.15) },
    uGround: { value: new Color(0.04, 0.04, 0.04) },
  });
  return { shared, flame, halo, ember, smoke, bed, glint };
}

/** Switch soft-depth / quality defines (tier change) and recompile. */
export function setFxMaterialMode(mats, { soft, low }) {
  for (const m of [mats.flame, mats.halo, mats.ember, mats.smoke, mats.bed, mats.glint]) {
    m.defines = defines(soft, low);
    m.depthTest = !soft;
    setBlend(m, m.userData.fxKind, low);
    m.needsUpdate = true;
  }
}

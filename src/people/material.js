// Materials for instanced, GPU-animated figures and props.
// MeshStandardMaterial (MeshPhysicalMaterial with sheen on high/ultra) patched via onBeforeCompile:
//   vertex   : skinning matrices fetched from the animation atlas (texelFetch, 2 frames lerped, optional
//              cross-fade), optional garment parts collapsed by a per-instance mask, per-class palette colour.
//   fragment : per-vertex roughness/metalness and procedural detail (linen box weave, wool, techelet twill,
//              the ephod's gold-and-four-colours thread, hair, fleece, the Tzitz inscription …), applied as a
//              derivative bump — no textures downloaded, one draw call per batch.
// Depth/distance materials get the same vertex code so shadows follow the animation.
import {
  MeshStandardMaterial, MeshPhysicalMaterial, MeshDepthMaterial, MeshDistanceMaterial, Color, CanvasTexture,
  LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, ShaderChunk,
} from 'three';
import { BLOCK_W, BLOCK_ROWS } from './anim.js';
import { AVNET_AVG } from './human.js';

const lin = (hex) => { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };

const VERT_PARS = /* glsl */`
uniform highp sampler2D uPBones;
attribute vec4 pIdx;
attribute vec4 pW;
attribute vec4 pMat;
attribute vec4 pAnimA;   // frame0, frame1, frac (cross-fades are pre-blended into scratch frames), fade (dither)
attribute vec4 pAnimB;   // x unused, y face-shape morph weight, z fullness morph weight, w part mask (figures)
attribute vec4 pTint;    // figures: skin, hair, garment A, garment B   props: rest xyz of the attach bone, bone
#ifdef P_MORPH
attribute vec4 pMorph;   // per-vertex shape deltas (rest space): xyz = face-shape field (× pAnimB.y), w = fullness along the normal (× pAnimB.z)
#endif
#ifndef P_DEPTH
uniform vec3 uPPal[18];
varying float vPFade;
varying vec4 vPMat;
varying vec2 vPUv;
varying vec3 vPStripe;
varying vec3 vPHair;
varying float vPSeed;
#endif
mat4 pFetch(int b, float frame) {
  int F = int(frame + 0.5);
  int x = (F >> 10) * ${BLOCK_W} + b * 3;
  int y = F & ${BLOCK_ROWS - 1};
  vec4 r0 = texelFetch(uPBones, ivec2(x, y), 0);
  vec4 r1 = texelFetch(uPBones, ivec2(x + 1, y), 0);
  vec4 r2 = texelFetch(uPBones, ivec2(x + 2, y), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 pBoneM(int b) {
  mat4 m = pFetch(b, pAnimA.x);
  #ifdef P_LERP
  if (pAnimA.z > 0.002) m += (pFetch(b, pAnimA.y) - m) * pAnimA.z;
  #endif
  return m;
}
mat4 pSkin() {
  #ifdef P_PROP
    if (pTint.w < -0.5) return mat4(1.0);
    mat4 m = pBoneM(int(pTint.w + 0.5));
    m[3].xyz += mat3(m) * pTint.xyz;
    return m;
  #else
    mat4 m = pBoneM(int(pIdx.x + 0.5)) * pW.x;
    if (pW.y > 0.0) m += pBoneM(int(pIdx.y + 0.5)) * pW.y;
    if (pW.z > 0.0) m += pBoneM(int(pIdx.z + 0.5)) * pW.z;
    if (pW.w > 0.0) m += pBoneM(int(pIdx.w + 0.5)) * pW.w;
    // a mantle's side panel below the seat (human.js mantle): a share of it hangs from the pelvis (bone 1) instead of
    // following the leg cage, as far as the pelvis stands upright — a seated man's mantle falls beside him; lying, the
    // cage alone. pMat.y = −0.98·hang on the cloth, −1 − 20·hang − h on its fringe (VERT_BEGIN)
    if (pMat.y < -0.005) {
      float hg = pMat.y > -0.99 ? -pMat.y / 0.98 : floor(-pMat.y - 1.0) / 20.0;
      if (hg > 0.01) {
        mat4 pel = pBoneM(1);
        hg *= smoothstep(0.7, 0.92, pel[1].y);
        m = m * (1.0 - hg) + pel * hg;
      }
    }
    return m;
  #endif
}
#ifndef P_DEPTH
vec3 pPalette(int cls) {
  #ifndef P_PROP
  if (cls == 1) return mix(uPPal[0], uPPal[1], clamp(pTint.x, 0.0, 1.0));
  if (cls == 2) return mix(uPPal[2], uPPal[3], clamp(pTint.y, 0.0, 1.0));
  // garments A / B: the role's four colours (tint 0..3); 4 = black, 5 = white (Actor.setGarb; palette 14..17)
  if (cls == 3) { int i = int(clamp(floor(pTint.z), 0.0, 5.0)); return (i < 4 ? uPPal[4 + i] : uPPal[14 + (i - 4) * 2]) * (0.94 + 0.12 * fract(pTint.z)); }
  if (cls == 4) { int i = int(clamp(floor(pTint.w), 0.0, 5.0)); return (i < 4 ? uPPal[8 + i] : uPPal[15 + (i - 4) * 2]) * (0.94 + 0.12 * fract(pTint.w)); }
  if (cls == 5) return pTint.z >= 4.0 ? uPPal[14 + int(clamp(floor(pTint.z) - 4.0, 0.0, 1.0)) * 2] * 0.9 : uPPal[12 + int(mod(floor(pTint.z * 7.0), 2.0))];
  #endif
  return vec3(1.0);
}
#endif
`;

const VERT_BEGINNORMAL = /* glsl */`
mat4 pSkinM = pSkin();
#define P_SKINNED
// a plumb fringe (pMat.y ≤ −1, see VERT_BEGIN) keeps its rest normal: it hangs in the figure's frame
vec3 objectNormal = pMat.y < -0.995 ? vec3(normal) : mat3(pSkinM) * vec3(normal);
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

const VERT_BEGIN = /* glsl */`
#ifndef P_SKINNED
mat4 pSkinM = pSkin();
#endif
vec3 pPos = position;
#ifdef P_MORPH
pPos += pMorph.xyz * pAnimB.y + normal * (pMorph.w * pAnimB.z);
#endif
vec3 transformed = (pSkinM * vec4(pPos, 1.0)).xyz;
#ifndef P_PROP
// a plumb fringe (the tzitzit): pMat.y = −1 − q − h, h = the vertex's height below its knot at rest (q: pSkin). The
// knot is skinned with the cloth; the strand hangs straight down from it in the figure's frame whatever the cloth does
// (the skirt cage turned it out horizontally over a seated man's knees), and what reaches the floor lies on it,
// pointing outward from where it meets the floor (or from under the knot, when the corner itself lies below it)
if (pMat.y < -0.995) {
  float pH = fract(-pMat.y - 1.0);
  transformed = (pSkinM * vec4(pPos + vec3(0.0, pH, 0.0), 1.0)).xyz - vec3(0.0, pH, 0.0);
  float under = 0.004 - transformed.y;
  if (under > 0.0) { transformed.y = 0.004; transformed.xz += normalize(transformed.xz + vec2(1e-4)) * min(under, pH) * 0.85; }
}
{
  int pg = int(pMat.w + 0.5) >> 3;
  if (pg > 0 && ((int(pAnimB.w + 0.5) >> (pg - 1)) & 1) == 0) transformed = vec3(0.0);
}
#endif
#if defined(P_DEPTH) && !defined(P_PROP)
if (pAnimA.w < 0.5) transformed = vec3(0.0); // a figure dithered more than half out casts no shadow
#endif
#ifdef USE_ALPHAHASH
vPosition = vec3( position );
#endif
`;

const VERT_COLOR = /* glsl */`
#if defined( USE_COLOR )
vColor = vec4(color * pPalette(int(pMat.w + 0.5) & 7), 1.0);
#endif
vPMat = vec4(pMat.x, max(pMat.y, 0.0), pMat.zw);   // (a plumb fringe's hang height is not a metalness)
vPUv = uv;
vPFade = pAnimA.w;
#ifndef P_PROP
vPStripe = pPalette(5);
// the brows' colour; < 0 = shaved off with the beard (mask bit 256: human.js GRP.SHAVEN_FACE, the metzora's seventh day)
vPHair = ((int(pAnimB.w + 0.5) >> 8) & 1) == 1 ? vec3(-1.0) : mix(uPPal[2], uPPal[3], clamp(pTint.y, 0.0, 1.0)) * 0.8;
vPSeed = fract(pTint.x * 13.17 + pTint.z * 3.31);
#else
vPStripe = vec3(0.0);
vPHair = vec3(0.0);
vPSeed = 0.0;
#endif
`;

const FRAG_PARS = /* glsl */`
varying float vPFade;
varying vec4 vPMat;
varying vec2 vPUv;
varying vec3 vPStripe;
varying vec3 vPHair;
varying float vPSeed;
uniform sampler2D uPGlyph;
const vec3 P_GOLD = ${lin('#e2b552')};
const vec3 P_TECH = ${lin('#183b74')};
const vec3 P_ARG = ${lin('#6b2752')};
const vec3 P_SHANI = ${lin('#a8202d')};
const vec3 P_LINEN = ${lin('#eeeadf')};
const vec3 P_AVNET_AVG = vec3(${AVNET_AVG.map((x) => x.toFixed(4)).join(', ')});
// per-fragment lighting response, set by the pattern code, read by RE_Direct_People
float pWrap;     // wrapped diffuse (skin subsurface, fleece)
vec3 pSSS;       // tint of the light bled past the terminator
float pTrans;    // thin-cloth translucency (light through the weave from behind)
float pBayer(vec2 p) { // 4x4 ordered dither threshold
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  const float M[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return (M[i] + 0.5) / 16.0;
}
float pHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float pNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pHash(i), pHash(i + vec2(1.0, 0.0)), u.x), mix(pHash(i + vec2(0.0, 1.0)), pHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 pPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

// Lighting response of figures: physical lighting + (a) wrapped, reddened diffuse past the terminator for skin
// (a cheap subsurface-scattering approximation - no plastic look) and a soft wrap for fleece and coats, (b) light
// through thin linen and wool from behind. (Hair gets its anisotropic sheen from strand-aligned bump in the pattern:
// a Kajiya-Kay term here cost ~40 % of the frame on the HD 4600.)
// Applies to every direct light (sun, moon, torches); the shadow term is already in directLight.color.
const FRAG_LIGHT = /* glsl */`
void RE_Direct_People(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  float ndl = dot(geometryNormal, directLight.direction);
  vec3 diff = BRDF_Lambert(material.diffuseContribution);
  if (pWrap > 0.0) {
    float wrapped = max(0.0, (ndl + pWrap) / ((1.0 + pWrap) * (1.0 + pWrap)));
    float extra = max(0.0, wrapped - max(ndl, 0.0));
    reflectedLight.directDiffuse += directLight.color * diff * extra * pSSS;
  }
  if (pTrans > 0.0) {
    float back = max(0.0, -ndl);
    float vd = max(0.0, dot(geometryViewDir, -directLight.direction));
    reflectedLight.directDiffuse += directLight.color * diff * pTrans * back * (0.3 + 0.7 * vd * vd);
  }
}
`;

// The extra terms run only for the sun/moon (directional and SunLight loops); fire point lights keep the plain
// physical response - every light's RE_Direct is inlined, so this keeps programs small and compiles fast.
let _lightsBegin = null;
function lightsBegin() {
  if (_lightsBegin != null) return _lightsBegin;
  const src = ShaderChunk.lights_fragment_begin || '';
  const i = src.indexOf('#if ( NUM_SUN_LIGHTS > 0 )');
  const j = src.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 )');
  if (i < 0 || j < 0) { _lightsBegin = ''; return ''; }
  _lightsBegin = src.slice(0, i) + src.slice(i, j).split('RE_Direct( directLight').join('RE_Direct_People( directLight') + src.slice(j);
  return _lightsBegin;
}

// pattern evaluation: modifies pCol, pH (height, metres), pRough, pMetal, pSheen and the lighting response
// (pWrap, pSSS, pTrans). pPx = metres per pixel.
// Every periodic detail of period P fades to its AVERAGE before it can alias: P_NY(P) = 1 while P spans >= 4 px,
// 0 once it spans <= 2 px (Nyquist), so weaves never turn into moire or crawl when the camera moves.
// Shell patterns (hair and beard) discard by a lock pattern and fade out entirely once the locks are sub-pixel.
const FRAG_PATTERN = /* glsl */`
#ifdef P_DITHER
if (vPFade < 0.999 && vPFade <= pBayer(gl_FragCoord.xy)) discard;
#endif
vec3 pCol = diffuseColor.rgb;
float pH = 0.0;
float pRough = vPMat.x;
float pMetal = vPMat.y;
float pSheen = 0.0;
pWrap = 0.0; pTrans = 0.0; pSSS = vec3(1.0);
vec2 pPx2 = fwidth(vPUv);
float pPx = max(max(pPx2.x, pPx2.y), 1e-6);
vec2 pGx = dFdx(vPUv), pGy = dFdy(vPUv);
#define P_NY(P) (1.0 - smoothstep(0.25 * (P), 0.5 * (P), pPx))
int pat = int(vPMat.z + 0.5);
// specular colour override (F0) for cloth that mixes metal and dyed strands; < 0 = the material's own
vec3 pSpec = vec3(-1.0);
#if defined(P_G_KG)
// the ephod's gold foil strands (4 of 28 per thread) make the even far colour glint gold
if (pat == 7) pSpec = mix(vec3(0.04), P_GOLD, 0.5);
#endif
// derivatives are taken here, never inside a pattern branch (gradients in flow control make the D3D compiler
// flatten every branch — compile times of many seconds per program on ANGLE)

if (pat == 1 || pat == 19 || pat == 25 || pat == 34) {
  pWrap = 0.45; pSSS = vec3(1.0, 0.42, 0.27);
  pCol *= mix(vec3(1.035, 0.985, 0.95), vec3(0.975, 1.0, 1.0), vPSeed); // per-figure undertone: ruddy … olive
}
#ifdef P_DETAIL
{
  vec2 uv = vPUv;
  float fold = pNoise(vec2(uv.x * 13.0 + vPSeed * 7.0, uv.y * 1.4));
#if defined(P_G_BEAST) || defined(P_G_FIG) || defined(P_G_FLESH)
  if (pat == 1) { // skin: pores and mottling, slightly sheened
    float f = P_NY(0.007);
    float n = mix(0.5, pNoise(uv * 140.0), f);
    float m = pNoise(uv * 9.0 + vPSeed * 3.0);
    pCol *= (0.95 + 0.08 * n) * mix(vec3(1.0), vec3(1.04, 0.97, 0.95), m);
    pRough = 0.48 + 0.14 * n;
    pH += 0.00008 * n * f;
    pSheen = 0.12;
  }
#endif
#if defined(P_G_FIG) || defined(P_G_PROP)
  if (pat == 2 || pat == 8) { // linen: meshubetzet box weave (ketonet) / plain (migba'at, avnet YK)
    float cell = pat == 2 ? 0.0085 : 0.003;
    vec2 c = uv / cell;
    vec2 f = abs(fract(c) - 0.5);
    float box = max(f.x, f.y);
    // each 'box' a softly raised cushion of floats, the boxes set off by shallow sunken lines
    float groove = smoothstep(0.3, 0.5, box);
    float fade = P_NY(cell * 0.4);
    pCol *= 1.0 - 0.07 * mix(0.38, groove, fade);   // 0.38 = the groove's mean coverage
    pH += 0.00045 * (1.0 - groove) * (1.0 - box) * fade;
    pH += 0.0035 * fold;
    // the fine thread texture and the slight slub of hand-spun linen
    float th = pNoise(vec2(uv.x * 900.0, uv.y * 60.0));
    pCol *= 0.975 + 0.05 * mix(0.5, pNoise(uv * 35.0), P_NY(0.028)) + 0.03 * (th - 0.5) * P_NY(0.0012);
    pSheen = 0.5;
    pTrans = 0.32;
  }
#endif
#if defined(P_G_FIG) || defined(P_G_KG) || defined(P_G_PROP)
  if (pat == 3 || pat == 15 || pat == 6) { // wool (tunics, mantles), clavi stripes, techelet twill
    float fade = P_NY(0.006);
    float n = mix(0.5, pNoise(uv * 170.0), fade);
    pCol *= 0.93 + 0.12 * n + 0.06 * (pNoise(uv * 23.0) - 0.5);
    if (pat == 6) pCol *= 1.0 - 0.07 * mix(0.5, step(0.5, fract((uv.x + uv.y) / 0.0035)), P_NY(0.0025));
    pH += 0.0045 * fold + 0.0003 * (n - 0.5) * fade;
    if (pat == 15) {
      float d = abs(abs(uv.x) - 0.082);
      float w = 0.0085;
      float s = 1.0 - smoothstep(w - pPx, w + pPx, d);
      pCol = mix(pCol, vPStripe * (0.9 + 0.1 * n), s);
    }
    pSheen = 0.45;
    pTrans = pat == 6 ? 0.06 : 0.12;
    pWrap = 0.15;
  }
#endif
#if defined(P_G_FLESH) || defined(P_G_KG) || defined(P_G_PROP)
  if (pat == 4) { // metal: soft hammer marks
    float n = pNoise(uv * 55.0);
    float hm = pNoise(uv * 160.0);
    pRough = clamp(pRough * (0.75 + 0.5 * n), 0.05, 1.0);
    pH += 0.00025 * n + 0.00012 * hm * P_NY(0.006);
  }
#endif
#if defined(P_G_FIG) || defined(P_G_PROP)
  if (pat == 5) { // avnet: linen wound winding on winding, embroidered (rokem) with wool in techelet,
    // argaman and tola'at shani - the design shows on one face (Rambam Klei HaMikdash 8:1, 8:15, 8:19)
    // the motif repeats every 2.6 cm: it is drawn while that period spans >= 4 px (P_NY of the motif, not of the
    // thread), then fades to its average — which is baked into the vertex colour (human.js AVNET_AVG), so the
    // band reads coloured at any distance and where the pattern is not drawn at all (low tier LOD1+)
    float fd = P_NY(0.026);
    // a row of diamonds between two argaman rails, the diamonds alternating techelet / tola'at shani with an
    // argaman heart; a small linen gap between motifs
    vec2 q = vec2(fract(uv.x / 0.026) - 0.5, uv.y / 0.03);
    float dd = abs(q.x) * 1.15 + abs(q.y) * 0.95;
    float dia = 1.0 - smoothstep(0.36, 0.42, dd);
    float inner = 1.0 - smoothstep(0.13, 0.18, dd);
    float rail = 1.0 - smoothstep(0.025, 0.045, abs(abs(q.y) - 0.62));
    float k = mod(floor(uv.x / 0.026), 2.0);
    vec3 dye = k < 0.5 ? P_TECH : P_SHANI;
    vec3 ground = P_LINEN * (pCol / max(vec3(1e-3), P_AVNET_AVG)); // linen, carrying the vertex shading
    vec3 design = mix(mix(ground, dye, dia), P_ARG, inner);
    design = mix(design, P_ARG, rail);
    pCol = mix(pCol, design, fd);
    pH += 0.0003 * max(dia, rail) * fd;
    pCol *= 0.97 + 0.05 * mix(0.5, pNoise(uv * 160.0), P_NY(0.004));
    pSheen = 0.4;
    pTrans = 0.15;
  }
#endif
#if defined(P_G_KG)
  if (pat == 7) { // ephod / choshen / cheshev: plain weave of ~1 mm composite threads, each twisted from
    // 28 strands - 6 techelet, 6 argaman, 6 tola'at shani, 6 shesh and 4 of beaten gold (Yoma 72a; Rashi Shemot
    // 28:6) - so the cloth is one even colour with a gold sparkle; the strands show only within arm's reach
    vec2 c = uv / 0.0011;
    vec2 cell = floor(c), f = fract(c);
    bool alongX = mod(cell.x + cell.y, 2.0) < 1.0;
    float along = alongX ? c.x : c.y, across = alongX ? f.y : f.x;
    float slot = mod(floor(fract(along * 0.55 + across * 0.9) * 14.0), 14.0);
    vec3 strand = slot < 12.0 ? (mod(slot, 4.0) < 1.0 ? P_TECH : mod(slot, 4.0) < 2.0 ? P_ARG : mod(slot, 4.0) < 3.0 ? P_SHANI : P_LINEN) : P_GOLD;
    float isGold = step(11.5, slot);
    float round_ = 1.0 - pow(abs(across - 0.5) * 2.0, 2.0);
    float fs = P_NY(0.0011), fw = P_NY(0.0022);
    vec3 avg = pCol;  // the woven average, baked into the vertex colour (human.js EPHOD_AVG)
    pCol = mix(avg, strand * (0.8 + 0.25 * round_), fs) * (0.95 + 0.07 * mix(0.5, pNoise(uv * 90.0), P_NY(0.011)));
    pMetal = mix(vPMat.y, isGold * 0.95, fs);
    pRough = mix(vPMat.x, mix(0.62, 0.28, isGold), fs);
    pSpec = mix(pSpec, isGold > 0.5 ? P_GOLD : vec3(0.04), fs);
    pH += 0.00025 * round_ * fw + 0.002 * fold;
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FIG)
  if (pat == 9) { // hair (scalp, beard): locks of strands
    float fade = P_NY(0.0024);
    float n = mix(0.5, pNoise(vec2(uv.x * 420.0, uv.y * 30.0)), fade);
    float clump = pNoise(vec2(uv.x * 90.0, uv.y * 8.0));
    pCol *= (0.7 + 0.5 * n * (0.7 + 0.3 * clump));
    // strands: fine ridges along the hair (v) stretch the specular lobe across them — an anisotropic sheen
    float ridge = mix(0.5, 0.5 + 0.5 * sin(uv.x * 2600.0 + clump * 6.0), P_NY(0.0012));
    pRough = 0.38 + 0.2 * n;
    pH += 0.0004 * n * fade + 0.0014 * clump + 0.00012 * ridge;
    pWrap = 0.25; pSSS = vec3(1.0, 0.8, 0.65);
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FIG)
  if (pat == 23 || pat == 35) { // hair shells / long coat: locks thinning toward the outer layer
    float t = vPMat.y; pMetal = 0.0;
    float lk = pNoise(vec2(uv.x * 260.0, uv.y * 24.0)) * 0.65 + pNoise(vec2(uv.x * 700.0, uv.y * 50.0)) * 0.35;
    if (pat == 23 || t > 0.0) {                                // shells (not the solid long coat): alpha-tested
      float far = smoothstep(0.0011, 0.0022, pPx);            // locks unresolvable: the shell fades away
      if (lk < mix(0.42, 0.7, t) || far > pBayer(gl_FragCoord.xy)) discard;
    }
    pCol *= 0.8 + 0.4 * lk;
    pRough = pat == 35 ? 0.66 : 0.45;   // a long animal coat is duller than combed human hair
    pH += 0.0002 * lk;
    pWrap = 0.3; pSSS = vec3(1.0, 0.8, 0.65);
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FLESH)
  if (pat == 10) { // fleece: dense locks (~1.5-3 cm) with dark crevices, fine crimp inside each lock
    vec2 w2 = uv * 48.0 + vec2(pNoise(uv * 17.0), pNoise(uv * 17.0 + 5.3)) * 1.8;
    float lock = pNoise(w2);
    float l2 = smoothstep(0.28, 0.78, lock);
    float fl = P_NY(0.02);
    float fine = mix(0.5, pNoise(uv * 230.0), P_NY(0.0045));
    float crimp = mix(0.5, 0.5 + 0.5 * sin((uv.y + 0.3 * pNoise(uv * 60.0)) * 900.0), P_NY(0.0025));
    pCol *= 0.8 + mix(0.12, 0.28 * l2, fl) + 0.07 * (fine - 0.5) + 0.04 * (crimp - 0.5) + 0.05 * (pNoise(uv * 5.0) - 0.5);
    pCol = mix(pCol, pCol * vec3(0.9, 0.82, 0.68), (1.0 - l2) * fl * 0.6);   // lanolin and dust in the crevices
    pH += 0.005 * l2 * fl + 0.0006 * fine;
    pRough = 0.95;
    pSheen = 0.6;
    pWrap = 0.55; pSSS = vec3(1.0, 0.95, 0.85);
  }
#endif
#if defined(P_G_PROP)
  if (pat == 11) { // wood
    float n = mix(0.5, pNoise(vec2(uv.x * 90.0, uv.y * 7.0)), P_NY(0.011));
    float ring = mix(0.5, 0.5 + 0.5 * sin(uv.x * 400.0 + pNoise(uv * vec2(20.0, 3.0)) * 6.0), P_NY(0.004));
    pCol *= 0.74 + 0.3 * n + 0.08 * (ring - 0.5);
    pH += 0.0003 * n;
  }
  if (pat == 40) { // bark of the pile's wood (Tamid 2:3): u round the branch, v along it. The roughness channel picks the
    // bark: smooth fig (≤ 0.8) with lenticels and faint rings, or the furrowed ridges of walnut / oil-wood (≥ 0.92)
    float deep = smoothstep(0.82, 0.92, vPMat.x);
    float fur = pNoise(vec2(uv.x * 85.0, uv.y * 6.0) + vec2(pNoise(uv * vec2(9.0, 2.0)) * 3.0, 0.0));
    float ridge = mix(0.5, 1.0 - abs(2.0 * fur - 1.0), P_NY(0.012));
    float mot = pNoise(uv * vec2(14.0, 5.0) + 1.7);
    float len = smoothstep(0.86, 0.94, pNoise(vec2(uv.x * 160.0, uv.y * 500.0))) * P_NY(0.005) * (1.0 - deep);
    float rings = mix(0.5, pNoise(vec2(uv.x * 4.0, uv.y * 60.0)), P_NY(0.01)) * (1.0 - deep);
    pCol *= mix(0.9 + 0.2 * mot + 0.06 * (rings - 0.5), 0.55 + 0.6 * ridge, deep);
    pCol = mix(pCol, pCol * vec3(0.78, 0.76, 0.72), len);                      // lenticels: small faint dashes
    pCol = mix(pCol, pCol * vec3(0.92, 1.02, 0.9), smoothstep(0.7, 0.85, mot) * 0.5);   // a greenish film in places
    pRough = mix(0.72, 0.9, deep);
    pH += mix(0.0002 * (mot - 0.5) - 0.0003 * len, 0.0018 * (ridge - 0.5), deep);
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FLESH) || defined(P_G_PROP)
  if (pat == 12) { // horn / hoof: growth rings, ridged
    float f = P_NY(0.006);
    float r = fract(uv.y / 0.012);
    pCol *= 0.85 + 0.2 * mix(0.5, smoothstep(0.3, 0.7, r), f);
    pCol *= 0.92 + 0.14 * pNoise(vec2(uv.x * 80.0, uv.y * 8.0));
    pH += 0.0005 * r * f;
  }
#endif
#if defined(P_G_KG) || defined(P_G_PROP)
  if (pat == 13) { // gem: polished cabochon
    pRough = 0.04;
    pCol *= 1.25;
  }
#endif
#if defined(P_G_KG)
  if (pat == 14) { // the Tzitz: gold band with its raised inscription
    float gl = textureGrad(uPGlyph, vec2(uv.x, 1.0 - uv.y), pGx, -pGy).r;
    pCol *= 1.0 - 0.45 * gl;
    pRough = 0.22 + 0.3 * gl;
    pH += 0.0006 * gl;
  }
#endif
#if defined(P_G_FLESH) || defined(P_G_PROP)
  if (pat == 16) { // reed / willow basketry: over-under plaits
    vec2 c = floor(uv / 0.012);
    vec2 fq = fract(uv / 0.012) - 0.5;
    float ch = mod(c.x + c.y, 2.0);
    float rnd = 1.0 - 4.0 * (ch > 0.5 ? fq.y * fq.y : fq.x * fq.x);
    float f = P_NY(0.012);
    pCol *= 0.8 + 0.25 * mix(0.6, rnd, f) * (0.85 + 0.3 * pNoise(uv * 80.0));
    pH += 0.0012 * rnd * f;
  }
#endif
#if defined(P_G_FLESH)
  if (pat == 17) { // meat (cut faces): dark muscle grain, continuous marbling veins of fat, wet
    float grain = mix(0.5, pNoise(vec2(uv.x * 30.0, uv.y * 140.0)), P_NY(0.007));
    float v1 = 1.0 - abs(2.0 * pNoise(uv * vec2(28.0, 46.0) + 3.1) - 1.0);
    float v2 = 1.0 - abs(2.0 * pNoise(uv * vec2(64.0, 41.0) + 7.7) - 1.0);
    float vein = smoothstep(0.86, 0.97, v1) * 0.9 + smoothstep(0.9, 0.98, v2) * 0.6;
    vein *= mix(0.35, 1.0, P_NY(0.006));
    pCol *= 0.82 + 0.3 * grain;
    pCol = mix(pCol, vec3(0.72, 0.6, 0.47), clamp(vein, 0.0, 1.0));
    pRough = 0.24 + 0.1 * vein;
    pH += 0.0004 * grain - 0.0003 * vein;
    pSheen = 0.25;
    pWrap = 0.3; pSSS = vec3(1.0, 0.3, 0.25);
  }
#endif
#if defined(P_G_FLESH)
  if (pat == 20) { // fat and fell of a flayed carcass: creamy, glossy membrane; red muscle shows where thin
    float n = pNoise(uv * 16.0) * 0.65 + pNoise(uv * 41.0) * 0.35;
    // where the fell is thin the red muscle shows through (the flayed limbs and lower legs, roughness <= 0.34);
    // the loose fat (the peder, roughness 0.42) stays creamy
    float expo = 1.0 - smoothstep(0.35, 0.4, vPMat.x);
    float thin = smoothstep(mix(0.52, 0.4, expo), mix(0.8, 0.7, expo), n) * mix(1.0, 1.15, expo);
    float fascia = 1.0 - abs(2.0 * pNoise(uv * vec2(55.0, 22.0)) - 1.0);
    fascia = smoothstep(0.88, 0.98, fascia) * P_NY(0.006);
    pCol = mix(pCol, pCol * vec3(0.62, 0.33, 0.27), thin * 0.75);
    pCol = mix(pCol, vec3(0.86, 0.8, 0.72), fascia * 0.4);
    pRough = 0.28 + 0.15 * (1.0 - thin);
    pH += 0.0009 * n;
    pSheen = 0.3;
    pWrap = 0.35; pSSS = vec3(1.0, 0.45, 0.35);
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FIG) || defined(P_G_PROP)
  if (pat == 18) { // cords / tzitzit strands
    pCol *= 0.88 + 0.16 * mix(0.5, step(0.5, fract((uv.y + uv.x) / 0.004)), P_NY(0.004));
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FLESH)
  if (pat == 21) { // short animal coat (bull, goat face): flowing strands, patchy tone
    float f = P_NY(0.003);
    float st = mix(0.5, pNoise(vec2(uv.x * 260.0, uv.y * 36.0)), f);
    float pch = pNoise(uv * 6.0);
    pCol *= (0.86 + 0.24 * st) * (0.9 + 0.2 * pch);
    pRough = 0.58 + 0.2 * st;
    pH += 0.0005 * st * f + 0.0015 * pNoise(uv * 24.0);
    pSheen = 0.35;
    pWrap = 0.3; pSSS = vec3(1.0, 0.85, 0.75);
  }
#endif
#if defined(P_G_FIG)
  if (pat == 26) { // wound linen (migba'at, mitznefet): a strip wound over itself - every winding laps the
    // last with a crisp edge and a little shadow under it; fine linen thread and soft creases inside each strip
    float P = 0.022;
    float ph = fract((uv.x + uv.y) / P);
    float fe = P_NY(P);
    float lip = smoothstep(0.0, 0.1, ph);
    pH += (0.0009 * sqrt(ph) + 0.0003 * sin(ph * 3.14159)) * fe;
    pCol *= 1.0 - (0.2 * (1.0 - lip) + 0.04 * (1.0 - ph)) * fe - 0.035 * (1.0 - fe);
    float th = pNoise(vec2(uv.x * 700.0, uv.y * 700.0));
    pCol *= 0.975 + 0.04 * mix(0.5, th, P_NY(0.0016)) + 0.04 * (pNoise(vec2((uv.x + uv.y) * 40.0, (uv.x - uv.y) * 140.0)) - 0.5);
    pSheen = 0.5;
    pTrans = 0.25;
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_PROP)
  if (pat == 28) { // rope: two-ply twist of fibre
    float f = P_NY(0.006);
    float ply = abs(fract(uv.y / 0.009 + uv.x / 0.012) - 0.5) * 2.0;
    pCol *= 0.78 + 0.32 * mix(0.6, 1.0 - ply * ply, f) * (0.85 + 0.3 * pNoise(uv * 300.0));
    pH += 0.0006 * (1.0 - ply * ply) * f;
    pRough = 0.92;
  }
#endif
#if defined(P_G_PROP)
  if (pat == 29) { // salt: coarse crystals that sparkle
    vec2 c = floor(uv / 0.0018);
    float h = pHash(c);
    float f = P_NY(0.0018);
    pCol *= 0.9 + 0.16 * mix(0.5, h, f);
    pRough = mix(0.5, h > 0.82 ? 0.08 : 0.55, f);
    pH += 0.0004 * h * f;
  }
#endif
#if defined(P_G_PROP)
  if (pat == 30) { // bread crust: browned blisters, flour dust
    float n = pNoise(uv * 60.0), b = pNoise(uv * 18.0);
    pCol *= mix(vec3(1.0), vec3(0.72, 0.55, 0.38), smoothstep(0.45, 0.8, b) * 0.7) * (0.92 + 0.12 * n);
    pH += 0.0012 * b + 0.0003 * n;
    pRough = 0.8;
  }
#endif
#if defined(P_G_PROP)
  if (pat == 31) { // fine flour (solet): matte, faintly grainy
    pCol *= 0.96 + 0.06 * mix(0.5, pNoise(uv * 600.0), P_NY(0.002));
    pRough = 0.97;
  }
#endif
#if defined(P_G_FLESH) || defined(P_G_PROP)
  if (pat == 32) { // liquid surface (oil, wine, water, blood)
    pRough = 0.04;
    pH += 0.00015 * pNoise(uv * 40.0);
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FLESH) || defined(P_G_PROP)
  if (pat == 33) { // feathers: overlapping rows of feather tips with paler edges
    vec2 c = uv / vec2(0.009, 0.007);
    vec2 cf = fract(c + vec2(0.5 * mod(floor(c.y), 2.0), 0.0)) - vec2(0.5, 0.0);
    float tip = smoothstep(0.55, 0.45, length(cf * vec2(1.0, 1.4)));
    float f = P_NY(0.008);
    pCol *= 0.86 + mix(0.12, 0.24 * tip, f);
    pH += 0.0004 * tip * f;
    pSheen = 0.5;
    pRough = 0.6;
    pWrap = 0.3;
  }
#endif
#if defined(P_G_BEAST) || defined(P_G_FLESH)
  if (pat == 36) { // muzzle: moist, dark, finely pebbled
    float n = pNoise(uv * 400.0);
    pCol *= 0.88 + 0.2 * mix(0.5, n, P_NY(0.003));
    pRough = 0.3 + 0.2 * n;
    pH += 0.0002 * n * P_NY(0.003);
    pWrap = 0.25; pSSS = vec3(1.0, 0.5, 0.4);
  }
#endif
#if defined(P_G_FLESH)
  if (pat == 39) { // charred on the pyre: a cracked black crust over roasted meat, greasy where the fat ran (Tamid 2:1)
    // a black, matt, blistered crust broken into plates by a network of fissures; deep in the fissures the roasted
    // meat shows dark red-brown; grey-white ash settled on it; only small spots wet with fat. (A brown roast tone over
    // half the surface and broad greasy patches read as smooth leather with a sheen, and lit the cut ends' edges white.)
    vec2 w = uv * 42.0 + vec2(pNoise(uv * 17.0), pNoise(uv * 17.0 + 3.7)) * 2.4;
    float cell = pNoise(w);
    float crack = (1.0 - smoothstep(0.0, 0.085, abs(cell - 0.5))) * smoothstep(0.25, 0.55, pNoise(uv * 11.0 + 7.1)) * P_NY(0.014);
    float blister = smoothstep(0.55, 0.9, pNoise(uv * 70.0 + 1.3)) * P_NY(0.004);
    float n = mix(0.5, pNoise(uv * 150.0), P_NY(0.005));
    pCol *= 0.45 + 0.5 * n;
    float thin = smoothstep(0.62, 0.9, pNoise(uv * 4.5 + 5.3));               // here and there the crust is thinner
    pCol = mix(pCol, vec3(0.016, 0.007, 0.004), thin * 0.35);
    pCol = mix(pCol, vec3(0.012, 0.004, 0.002), crack * 0.9);                // the fissures: dark, a little red deep in them
    pCol += vec3(0.01, 0.0015, 0.0) * crack * smoothstep(0.03, 0.0, abs(cell - 0.5));
    float ash = smoothstep(0.72, 0.86, pNoise(uv * 48.0 + 11.7)) * smoothstep(0.35, 0.7, pNoise(uv * 5.0 + 3.1)) * P_NY(0.006);
    pCol = mix(pCol, vec3(0.07, 0.067, 0.064), ash * 0.35);
    float grease = smoothstep(0.8, 0.95, pNoise(uv * 9.0 + 2.0)) * (1.0 - ash) * (1.0 - crack);
    pRough = mix(mix(0.9, 0.55, grease), 0.98, ash);
    pH += 0.0016 * cell - 0.0016 * crack + 0.0005 * blister + 0.0002 * n + 0.0003 * ash;
    pSheen = 0.0;
  }
  if (pat == 38) { // the inner face of a flayed hide: pale fascia, fine vessels
    float v = 1.0 - abs(2.0 * pNoise(uv * vec2(30.0, 50.0)) - 1.0);
    pCol = mix(pCol, pCol * vec3(0.85, 0.5, 0.45), smoothstep(0.9, 0.98, v) * P_NY(0.006) * 0.6);
    pRough = 0.35;
    pSheen = 0.2;
  }
#endif
}
#endif
#if defined(P_G_FIG)
if (pat == 22) { // eyeball: sclera, iris with radial fibres and a dark limbal ring, pupil; a wet cornea
  vec2 uv = vPUv;
  float r = length(uv);
  float aa = max(pPx * 0.75, 0.015);
  float ir = 0.47, pr = 0.17;
  float iris = 1.0 - smoothstep(ir - aa, ir + aa, r);
  float pupil = 1.0 - smoothstep(pr - aa, pr + aa, r);
  float ang = atan(uv.y, uv.x);
  float fib = 0.82 + 0.36 * pNoise(vec2(ang * 7.0, r * 16.0));
  vec3 irisC = mix(vec3(0.045, 0.024, 0.012), vec3(0.17, 0.09, 0.035) * (0.7 + 0.6 * vPSeed), smoothstep(pr, ir * 0.9, r)) * fib;
  irisC *= 1.0 - 0.65 * smoothstep(ir - 0.09, ir, r);
  vec3 sclera = vec3(0.6, 0.56, 0.52) * (1.0 - 0.3 * smoothstep(0.55, 1.0, r)) * mix(vec3(1.0), vec3(1.0, 0.84, 0.8), smoothstep(0.5, 1.0, abs(uv.x)));
  pCol = mix(sclera, irisC, iris);
  pCol = mix(pCol, vec3(0.006), pupil);
  // the upper lid and lashes shade the top of the eye (a lit sclera all round reads as a stare)
  pCol *= 1.0 - 0.5 * smoothstep(-0.05, 0.22, uv.y);
  pRough = 0.07; pMetal = 0.0; pSheen = 0.0; pWrap = 0.0;
}
#endif
#if defined(P_G_BEAST) || defined(P_G_FLESH)
if (pat == 27) { // animal eye: a large dark-amber iris, horizontal oblong pupil, wet
  vec2 uv = vPUv;
  float r = length(uv);
  float aa = max(pPx, 0.02);
  float pup = 1.0 - smoothstep(1.0 - aa * 4.0, 1.0 + aa * 4.0, length(vec2(uv.x / 0.46, uv.y / 0.16)));
  vec3 irisC = pCol * (0.72 + 0.4 * pNoise(vec2(atan(uv.y, uv.x) * 6.0, r * 9.0)));
  irisC *= 1.0 - 0.6 * smoothstep(0.72, 0.98, r);
  pCol = mix(irisC, vec3(0.008), pup);
  pRough = 0.05; pMetal = 0.0; pSheen = 0.0;
}
#endif
#if defined(P_G_FIG)
if (pat == 34) { // nails
  pRough = 0.3; pSheen = 0.1;
}
#endif
#ifdef P_G_FIG
if (pat == 19 || pat == 25) { // face skin: brows, nostrils, lips, the flush of cheeks and nose; painted eyes at LOD1
  vec2 uv = vPUv;
  float n = pNoise(uv * 140.0);
  pCol *= 0.96 + 0.06 * mix(0.5, n, P_NY(0.007));
  pRough = 0.46 + 0.12 * n;
  pSheen = 0.12;
  if (uv.y < 5.0) {
    float ff = 1.0 - smoothstep(0.0018, 0.0036, pPx);
    float aa = max(pPx * 0.7, 0.0003);
    // blood under the skin: cheeks and nose a little warmer
    float flush = exp(-pow((abs(uv.x) - 0.04) / 0.018, 2.0) - pow((uv.y + 0.022) / 0.016, 2.0)) + 0.8 * exp(-pow(uv.x / 0.012, 2.0) - pow((uv.y + 0.036) / 0.01, 2.0));
    pCol *= mix(vec3(1.0), vec3(1.06, 0.93, 0.9), clamp(flush, 0.0, 1.0));
    float ex = abs(uv.x) - 0.031;
    float ey = uv.y - 0.008;
    if (pat == 25) { // LOD1: eyes drawn on the face (no modelled eyeballs)
      float sock = exp(-(ex * ex) / (0.0125 * 0.0125) - (ey - 0.002) * (ey - 0.002) / (0.0095 * 0.0095));
      pCol *= 1.0 - (0.2 + 0.12 * (1.0 - ff)) * sock;
      float ew = 0.0118;
      float tx = clamp(ex / ew, -1.0, 1.0);
      float hh = 0.0041 * (1.0 - tx * tx);
      float ec = ey + 0.0006 * tx;
      float inEye = (1.0 - smoothstep(hh - aa, hh + aa, abs(ec))) * step(abs(ex), ew) * ff;
      vec3 sclera = pCol * vec3(1.18, 1.12, 1.05) + vec3(0.05, 0.045, 0.04);
      float ir = length(vec2(ex + 0.0006, ey + 0.0003));
      float iris = 1.0 - smoothstep(0.0043 - aa, 0.0043 + aa, ir);
      vec3 eyeCol = mix(sclera, vec3(0.04, 0.026, 0.02), iris);
      eyeCol *= 1.0 - 0.45 * smoothstep(-0.001, hh, ec);
      pCol = mix(pCol, eyeCol, inEye);
      float lash = (1.0 - smoothstep(0.0004, 0.0004 + aa, abs(ec - hh))) * step(abs(ex), ew * 1.02) * ff;
      pCol = mix(pCol, vec3(0.03, 0.02, 0.015), lash * 0.8);
    } else {
      // around the modelled eyes: the socket a touch darker
      float sock = exp(-(ex * ex) / (0.016 * 0.016) - (ey - 0.003) * (ey - 0.003) / (0.011 * 0.011));
      pCol *= 1.0 - 0.1 * sock;
    }
    // brows: hair-coloured, thicker at the inner end, with a few strands
    float bxs = (ex + 0.002) / 0.02;
    float by = ey - (0.0185 + 0.0028 * (1.0 - bxs * bxs));
    float bw = 0.0021 * (1.0 - 0.5 * smoothstep(-0.6, 1.0, bxs));
    float strands = mix(1.0, 0.7 + 0.6 * pNoise(vec2(uv.x * 900.0, uv.y * 220.0)), ff);
    float brow = (1.0 - smoothstep(bw, bw + aa * 1.5, abs(by))) * (1.0 - smoothstep(0.88, 1.05, abs(bxs))) * strands;
    pCol = mix(pCol, vPHair * 0.9, clamp(brow, 0.0, 1.0) * mix(0.4, 0.68, ff) * step(0.0, vPHair.x));
    float nos = 1.0 - smoothstep(0.0016, 0.0016 + aa, length(vec2((abs(uv.x) - 0.0085) / 1.6, uv.y + 0.0395)));
    pCol *= 1.0 - 0.6 * nos * ff;
    float lx = uv.x / 0.021;
    float ly = uv.y + 0.0615;
    float lipW = 1.0 - smoothstep(0.82, 1.0, abs(lx));
    float upper = (1.0 - smoothstep(0.0038 - aa, 0.0038 + aa, ly)) * step(0.0, ly);
    float lower = (1.0 - smoothstep(0.005 - aa, 0.005 + aa, -ly)) * step(ly, 0.0);
    float lip = (upper + lower) * lipW * (1.0 - lx * lx * 0.5);
    pCol = mix(pCol, pCol * vec3(0.86, 0.6, 0.56), lip * 0.7);
    pRough = mix(pRough, 0.32, lip);
    float line = (1.0 - smoothstep(0.0005, 0.0005 + aa, abs(ly))) * lipW * ff;
    pCol = mix(pCol, pCol * 0.32, line);
  }
}
#endif
diffuseColor.rgb = pCol;
`;

let _glyph = null;
/** "קדש לה׳" — the Tzitz inscription, drawn at runtime (the Name abbreviated, as is customary in print) */
function glyphTexture() {
  if (_glyph) return _glyph;
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = 256; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 48);
  g.fillStyle = '#fff';
  g.font = 'bold 34px "Times New Roman", "David", "Frank Ruehl CLM", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.direction = 'rtl';
  g.fillText('קדש לה׳', 128, 26);
  _glyph = new CanvasTexture(c);
  _glyph.colorSpace = SRGBColorSpace;
  _glyph.minFilter = LinearMipmapLinearFilter;
  _glyph.magFilter = LinearFilter;
  return _glyph;
}

function patchVertex(src, { depth }) {
  let s = src.replace('#include <common>', `#include <common>\n${depth ? '#define P_DEPTH\n' : ''}${VERT_PARS}`);
  if (s.includes('#include <beginnormal_vertex>')) s = s.replace('#include <beginnormal_vertex>', VERT_BEGINNORMAL);
  s = s.replace('#include <begin_vertex>', VERT_BEGIN);
  if (!depth) s = s.replace('#include <color_vertex>', `#include <color_vertex>\n${VERT_COLOR}`);
  return s;
}

/**
 * opts: { atlas (AnimAtlas), palette: Color[18], prop: bool, lerp: bool, detail: bool, physical: bool, morph: bool,
 *         groups: ['FIG'|'KG'|'BEAST'|'PROP'|'FLESH'] (pattern code compiled in; default FIG, or PROP for props),
 *         dither: bool (per-instance fade in pAnimA.w by ordered dither: far-cap and flowing-crowd fades) }
 */
export function createPeopleMaterial(opts) {
  const { atlas, prop = false, lerp = true, detail = true, physical = false, dither = false } = opts;
  const M = physical ? MeshPhysicalMaterial : MeshStandardMaterial;
  const params = { vertexColors: true, roughness: 0.8, metalness: 0 };
  if (physical) Object.assign(params, { sheen: 1, sheenRoughness: 0.6, sheenColor: new Color(1, 1, 1) });
  const mat = new M(params);
  mat.name = prop ? 'people-prop' : 'people-figure';
  // pattern groups compiled into this program (see FRAG_PATTERN): FIG, KG, BEAST, PROP, FLESH
  const groups = (opts.groups || (prop ? ['PROP'] : ['FIG'])).map((g) => `P_G_${g}`);
  const defines = [prop ? 'P_PROP' : null, lerp ? 'P_LERP' : null, detail ? 'P_DETAIL' : null, dither ? 'P_DITHER' : null, opts.morph ? 'P_MORPH' : null, ...groups].filter(Boolean);
  mat.defines = Object.fromEntries(defines.map((d) => [d, '']));
  const palette = { value: opts.palette || Array.from({ length: 18 }, () => new Color(1, 1, 1)) };
  const glyph = { value: glyphTexture() };
  mat.userData.palette = palette;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPBones = atlas.uniform;
    shader.uniforms.uPPal = palette;
    shader.uniforms.uPGlyph = glyph;
    shader.vertexShader = patchVertex(shader.vertexShader, { depth: false });
    let f = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_PARS}`);
    const lb = lightsBegin();
    if (lb) {
      f = f.replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${FRAG_LIGHT}`);
      f = f.replace('#include <lights_fragment_begin>', lb);
    }
    f = f.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_PATTERN}`);
    f = f.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pRough;');
    f = f.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = pMetal;');
    f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef P_DETAIL
normal = pPerturb(-vViewPosition, normal, vec2(dFdx(pH), dFdy(pH)), faceDirection);
#endif`);
    f = f.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
if (pSpec.x >= 0.0) { material.specularColor = pSpec; material.specularColorBlended = mix(pSpec, diffuseColor.rgb, metalnessFactor); }`);
    if (physical) {
      f = f.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_SHEEN
material.sheenColor = pCol * pSheen;
material.sheenRoughness = 0.6;
#endif`);
    }
    shader.fragmentShader = f;
  };
  const key = `people:${defines.join(',')}:${physical ? 'phys' : 'std'}:v7`;
  mat.customProgramCacheKey = () => key;
  return mat;
}

export function createPeopleDepthMaterials(atlas, prop = false) {
  const mk = (M, extra) => {
    const m = new M(extra);
    m.defines = prop ? { P_PROP: '', P_LERP: '' } : { P_LERP: '' };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uPBones = atlas.uniform;
      shader.vertexShader = patchVertex(shader.vertexShader, { depth: true });
    };
    const key = `people-depth:${prop ? 'prop' : 'fig'}:v5`;
    m.customProgramCacheKey = () => key;
    return m;
  };
  return { depth: mk(MeshDepthMaterial, {}), distance: mk(MeshDistanceMaterial, {}) };
}

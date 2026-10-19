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
  LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace,
} from 'three';
import { BLOCK_W, BLOCK_ROWS } from './anim.js';

const lin = (hex) => { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };

const VERT_PARS = /* glsl */`
uniform highp sampler2D uPBones;
attribute vec4 pIdx;
attribute vec4 pW;
attribute vec4 pMat;
attribute vec4 pAnimA;   // frame0, frame1, frac (cross-fades are pre-blended into scratch frames), fade (dither)
attribute vec4 pAnimB;   // unused xyz, part mask (figures)
attribute vec4 pTint;    // figures: skin, hair, garment A, garment B   props: rest xyz of the attach bone, bone
#ifndef P_DEPTH
uniform vec3 uPPal[14];
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
    return m;
  #endif
}
#ifndef P_DEPTH
vec3 pPalette(int cls) {
  #ifndef P_PROP
  if (cls == 1) return mix(uPPal[0], uPPal[1], clamp(pTint.x, 0.0, 1.0));
  if (cls == 2) return mix(uPPal[2], uPPal[3], clamp(pTint.y, 0.0, 1.0));
  if (cls == 3) { int i = int(clamp(floor(pTint.z), 0.0, 3.0)); return uPPal[4 + i] * (0.94 + 0.12 * fract(pTint.z)); }
  if (cls == 4) { int i = int(clamp(floor(pTint.w), 0.0, 3.0)); return uPPal[8 + i] * (0.94 + 0.12 * fract(pTint.w)); }
  if (cls == 5) return uPPal[12 + int(mod(floor(pTint.z * 7.0), 2.0))];
  #endif
  return vec3(1.0);
}
#endif
`;

const VERT_BEGINNORMAL = /* glsl */`
mat4 pSkinM = pSkin();
#define P_SKINNED
vec3 objectNormal = mat3(pSkinM) * vec3(normal);
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

const VERT_BEGIN = /* glsl */`
#ifndef P_SKINNED
mat4 pSkinM = pSkin();
#endif
vec3 transformed = (pSkinM * vec4(position, 1.0)).xyz;
#ifndef P_PROP
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
vPMat = pMat;
vPUv = uv;
vPFade = pAnimA.w;
#ifndef P_PROP
vPStripe = uPPal[12 + int(mod(floor(pTint.z * 7.0), 2.0))];
vPHair = mix(uPPal[2], uPPal[3], clamp(pTint.y, 0.0, 1.0)) * 0.8;
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
const vec3 P_TECH = ${lin('#2f5d9e')};
const vec3 P_ARG = ${lin('#6b2752')};
const vec3 P_SHANI = ${lin('#a8202d')};
const vec3 P_LINEN = ${lin('#eeeadf')};
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

// pattern evaluation: modifies pCol, pH (height, metres), pRough, pMetal, pSheen. pPx = metres per pixel.
// Every periodic detail of period P fades to its AVERAGE before it can alias: P_NY(P) = 1 while P spans >= 4 px,
// 0 once it spans <= 2 px (Nyquist), so weaves never turn into moire or crawl when the camera moves.
const FRAG_PATTERN = /* glsl */`
#ifdef P_DITHER
if (vPFade < 0.999 && vPFade <= pBayer(gl_FragCoord.xy)) discard;
#endif
vec3 pCol = diffuseColor.rgb;
float pH = 0.0;
float pRough = vPMat.x;
float pMetal = vPMat.y;
float pSheen = 0.0;
vec2 pPx2 = fwidth(vPUv);
float pPx = max(max(pPx2.x, pPx2.y), 1e-6);
vec2 pGx = dFdx(vPUv), pGy = dFdy(vPUv);
#define P_NY(P) (1.0 - smoothstep(0.25 * (P), 0.5 * (P), pPx))
#ifdef P_DETAIL
{
  int pat = int(vPMat.z + 0.5);
  vec2 uv = vPUv;
  float fold = pNoise(vec2(uv.x * 13.0 + vPSeed * 7.0, uv.y * 1.4));
  if (pat == 1) { // skin
    float f = P_NY(0.007);
    float n = mix(0.5, pNoise(uv * 140.0), f);
    pCol *= 0.95 + 0.08 * n;
    pRough = 0.5 + 0.12 * n;
    pSheen = 0.12;
  } else if (pat == 2 || pat == 8) { // linen: meshubetzet box weave (ketonet) / plain (migba'at, avnet YK)
    float cell = pat == 2 ? 0.0085 : 0.003;
    vec2 c = uv / cell;
    vec2 f = abs(fract(c) - 0.5);
    float box = max(f.x, f.y);
    // each 'box' a softly raised cushion of floats, the boxes set off by shallow sunken lines
    float groove = smoothstep(0.3, 0.5, box);
    float fade = P_NY(cell * 0.4);
    pCol *= 1.0 - 0.055 * mix(0.38, groove, fade);   // 0.38 = the groove's mean coverage
    pH += 0.00035 * (1.0 - groove) * (1.0 - box) * fade;
    pH += 0.0035 * fold;
    pCol *= 0.975 + 0.05 * mix(0.5, pNoise(uv * 35.0), P_NY(0.028));
    pSheen = 0.45;
  } else if (pat == 3 || pat == 15 || pat == 6) { // wool (tunics, mantles), clavi stripes, techelet twill
    float fade = P_NY(0.006);
    float n = mix(0.5, pNoise(uv * 170.0), fade);
    pCol *= 0.93 + 0.12 * n + 0.05 * (pNoise(uv * 23.0) - 0.5);
    if (pat == 6) pCol *= 1.0 - 0.07 * mix(0.5, step(0.5, fract((uv.x + uv.y) / 0.0035)), P_NY(0.0025));
    pH += 0.0045 * fold + 0.00025 * (n - 0.5) * fade;
    if (pat == 15) {
      float d = abs(abs(uv.x) - 0.082);
      float w = 0.0085;
      float s = 1.0 - smoothstep(w - pPx, w + pPx, d);
      pCol = mix(pCol, vPStripe * (0.9 + 0.1 * n), s);
    }
    pSheen = 0.35;
  } else if (pat == 4) { // metal: soft hammer marks
    float n = pNoise(uv * 55.0);
    pRough = clamp(pRough * (0.75 + 0.5 * n), 0.05, 1.0);
    pH += 0.00025 * n;
  } else if (pat == 5) { // avnet: linen wound many times; small wool figures in techelet, argaman, shani (kilayim)
    float fw = P_NY(0.0042), fd = P_NY(0.005);
    float wind = smoothstep(0.4, 0.5, abs(fract((uv.y + uv.x * 0.12) / 0.021) - 0.5));
    pCol *= 1.0 - 0.14 * mix(0.12, wind, fw);
    pH -= 0.0006 * wind * fw;
    vec2 q = vec2(fract(uv.x / 0.032) - 0.5, fract((uv.y + uv.x * 0.12) / 0.021) - 0.5);
    float dia = 1.0 - smoothstep(0.1, 0.16, abs(q.x) + abs(q.y) * 0.85);
    float k = mod(floor(uv.x / 0.032), 3.0);
    vec3 dye = k < 0.5 ? P_TECH : (k < 1.5 ? P_ARG : P_SHANI);
    vec3 dyeAvg = (P_TECH + P_ARG + P_SHANI) / 3.0;
    pCol = mix(pCol, mix(dyeAvg, dye, fd), mix(0.045, dia, fd) * 0.55);
    pCol *= 0.97 + 0.05 * mix(0.5, pNoise(uv * 60.0), P_NY(0.017));
  } else if (pat == 7) { // ephod / choshen / cheshev: plain weave of ~1 mm composite threads, each twisted from
    // 28 strands — 6 techelet, 6 argaman, 6 tola'at shani, 6 shesh and 4 of beaten gold (Yoma 72a; Rashi Shemot
    // 28:6) — so the cloth is one even colour with a gold sparkle; the strands show only within arm's reach
    vec2 c = uv / 0.0011;
    vec2 cell = floor(c), f = fract(c);
    bool alongX = mod(cell.x + cell.y, 2.0) < 1.0;             // over/under: warp or weft on top in this cell
    float along = alongX ? c.x : c.y, across = alongX ? f.y : f.x;
    float slot = mod(floor(fract(along * 0.55 + across * 0.9) * 14.0), 14.0);
    vec3 strand = slot < 12.0 ? (mod(slot, 4.0) < 1.0 ? P_TECH : mod(slot, 4.0) < 2.0 ? P_ARG : mod(slot, 4.0) < 3.0 ? P_SHANI : P_LINEN) : P_GOLD;
    float isGold = step(11.5, slot);
    float round_ = 1.0 - pow(abs(across - 0.5) * 2.0, 2.0);  // the thread's round profile
    float fs = P_NY(0.0011), fw = P_NY(0.0022);
    vec3 avg = (P_TECH + P_ARG + P_SHANI + P_LINEN) * (3.0 / 14.0) + P_GOLD * (2.0 / 14.0);
    pCol = mix(avg, strand * (0.8 + 0.25 * round_), fs) * (0.95 + 0.07 * mix(0.5, pNoise(uv * 90.0), P_NY(0.011)));
    pMetal = mix(0.24, isGold * 0.95, fs);
    pRough = mix(0.46, mix(0.62, 0.28, isGold), fs);
    pH += 0.00025 * round_ * fw + 0.002 * fold;
  } else if (pat == 9) { // hair
    float fade = P_NY(0.0024);
    float n = mix(0.5, pNoise(vec2(uv.x * 420.0, uv.y * 30.0)), fade);
    float clump = pNoise(vec2(uv.x * 90.0, uv.y * 8.0));
    pCol *= 0.8 + 0.4 * n * (0.7 + 0.3 * clump);
    pRough = 0.55 + 0.25 * n;
    pH += 0.0004 * n * fade + 0.0012 * clump;
  } else if (pat == 10) { // fleece: dense small locks (~1.5 cm) with dark crevices, fine crimp inside each lock
    vec2 w2 = uv * 64.0 + vec2(pNoise(uv * 21.0), pNoise(uv * 21.0 + 5.3)) * 1.6;
    float lock = pNoise(w2);
    float l2 = smoothstep(0.3, 0.75, lock);
    float fl = P_NY(0.016);
    float fine = mix(0.5, pNoise(uv * 230.0), P_NY(0.0045));
    pCol *= 0.86 + mix(0.08, 0.2 * l2, fl) + 0.07 * (fine - 0.5) + 0.05 * (pNoise(uv * 5.0) - 0.5);
    pH += 0.0035 * l2 * fl + 0.0006 * fine;
    pRough = 0.92;
    pSheen = 0.55;
  } else if (pat == 11) { // wood
    float n = mix(0.5, pNoise(vec2(uv.x * 90.0, uv.y * 7.0)), P_NY(0.011));
    pCol *= 0.78 + 0.34 * n;
    pH += 0.0003 * n;
  } else if (pat == 12) { // horn / hoof
    float f = P_NY(0.006);
    float r = fract(uv.y / 0.012);
    pCol *= 0.85 + 0.2 * mix(0.5, smoothstep(0.3, 0.7, r), f);
    pH += 0.0004 * r * f;
  } else if (pat == 13) { // gem
    pRough = 0.06;
    pCol *= 1.2;
  } else if (pat == 14) { // the Tzitz: gold band with its raised inscription
    float gl = textureGrad(uPGlyph, vec2(uv.x, 1.0 - uv.y), pGx, -pGy).r;
    pCol *= 1.0 - 0.45 * gl;
    pRough = 0.22 + 0.3 * gl;
    pH += 0.0006 * gl;
  } else if (pat == 16) { // reed / willow basketry
    vec2 c = floor(uv / 0.012);
    float ch = mix(0.5, mod(c.x + c.y, 2.0), P_NY(0.012));
    pCol *= 0.82 + 0.26 * ch * pNoise(uv * 80.0);
    pH += 0.0008 * ch;
  } else if (pat == 17) { // meat (cut faces): dark muscle grain, continuous marbling veins of fat, wet
    float grain = mix(0.5, pNoise(vec2(uv.x * 30.0, uv.y * 140.0)), P_NY(0.007));
    float v1 = 1.0 - abs(2.0 * pNoise(uv * vec2(28.0, 46.0) + 3.1) - 1.0);
    float v2 = 1.0 - abs(2.0 * pNoise(uv * vec2(64.0, 41.0) + 7.7) - 1.0);
    float vein = smoothstep(0.86, 0.97, v1) * 0.9 + smoothstep(0.9, 0.98, v2) * 0.6;
    vein *= mix(0.35, 1.0, P_NY(0.006));
    pCol *= 0.82 + 0.3 * grain;
    pCol = mix(pCol, vec3(0.72, 0.6, 0.47), clamp(vein, 0.0, 1.0));
    pRough = 0.26 + 0.1 * vein;
    pH += 0.0004 * grain - 0.0003 * vein;
    pSheen = 0.25;
  } else if (pat == 20) { // fat and fell of a flayed carcass: creamy, glossy membrane; red muscle shows where thin
    float n = pNoise(uv * 16.0) * 0.65 + pNoise(uv * 41.0) * 0.35;
    float thin = smoothstep(0.52, 0.8, n);
    float fascia = 1.0 - abs(2.0 * pNoise(uv * vec2(55.0, 22.0)) - 1.0);
    fascia = smoothstep(0.88, 0.98, fascia) * P_NY(0.006);
    pCol = mix(pCol, pCol * vec3(0.62, 0.33, 0.27), thin * 0.75);
    pCol = mix(pCol, vec3(0.86, 0.8, 0.72), fascia * 0.4);
    pRough = 0.3 + 0.15 * (1.0 - thin);
    pH += 0.0009 * n;
    pSheen = 0.3;
  } else if (pat == 18) { // cords / tzitzit strands
    pCol *= 0.88 + 0.16 * mix(0.5, step(0.5, fract((uv.y + uv.x) / 0.004)), P_NY(0.004));
  } else if (pat == 21) { // short animal coat (goat, bull, dove plumage): flowing strands, patchy tone
    float f = P_NY(0.003);
    float st = mix(0.5, pNoise(vec2(uv.x * 260.0, uv.y * 36.0)), f);
    float pch = pNoise(uv * 6.0);
    pCol *= (0.86 + 0.24 * st) * (0.9 + 0.2 * pch);
    pRough = 0.6 + 0.2 * st;
    pH += 0.0005 * st * f + 0.0015 * pNoise(uv * 24.0);
    pSheen = 0.3;
  }
}
#endif
#ifndef P_PROP
if (int(vPMat.z + 0.5) == 19) { // face: skin + eyes, brows, nostrils, lips; always drawn (small screen area)
  vec2 uv = vPUv;
  float n = pNoise(uv * 140.0);
  pCol *= 0.96 + 0.06 * mix(0.5, n, P_NY(0.007));
  pRough = 0.5 + 0.1 * n;
  pSheen = 0.12;
  if (uv.y < 5.0) {
    // fine features (4 mm eye slits, lash and lip lines) fade to their mean before they can shimmer
    float ff = 1.0 - smoothstep(0.0018, 0.0036, pPx);
    float aa = max(pPx * 0.7, 0.0003);
    float ex = abs(uv.x) - 0.031;
    float ey = uv.y - 0.008;
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
    float bxs = (ex + 0.002) / 0.019;
    float by = ey - (0.0175 + 0.0025 * (1.0 - bxs * bxs));
    float brow = (1.0 - smoothstep(0.0017, 0.0017 + aa * 1.5, abs(by))) * (1.0 - smoothstep(0.9, 1.05, abs(bxs)));
    pCol = mix(pCol, vPHair, brow * mix(0.4, 0.85, ff));
    float nos = 1.0 - smoothstep(0.0015, 0.0015 + aa, length(vec2((abs(uv.x) - 0.0085) / 1.5, uv.y + 0.0395)));
    pCol *= 1.0 - 0.55 * nos * ff;
    float lx = uv.x / 0.021;
    float ly = uv.y + 0.0615;
    float lipW = 1.0 - smoothstep(0.85, 1.0, abs(lx));
    float upper = (1.0 - smoothstep(0.0035 - aa, 0.0035 + aa, ly)) * step(0.0, ly);
    float lower = (1.0 - smoothstep(0.0045 - aa, 0.0045 + aa, -ly)) * step(ly, 0.0);
    float lip = (upper + lower) * lipW * (1.0 - lx * lx * 0.5);
    pCol = mix(pCol, pCol * vec3(0.9, 0.66, 0.62), lip * 0.75);
    float line = (1.0 - smoothstep(0.0005, 0.0005 + aa, abs(ly))) * lipW * ff;
    pCol = mix(pCol, pCol * 0.35, line);
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
 * opts: { atlas (AnimAtlas), palette: Color[14], prop: bool, lerp: bool, detail: bool, physical: bool,
 *         dither: bool (per-instance fade in pAnimA.w by ordered dither: far-cap and flowing-crowd fades) }
 */
export function createPeopleMaterial(opts) {
  const { atlas, prop = false, lerp = true, detail = true, physical = false, dither = false } = opts;
  const M = physical ? MeshPhysicalMaterial : MeshStandardMaterial;
  const params = { vertexColors: true, roughness: 0.8, metalness: 0 };
  if (physical) Object.assign(params, { sheen: 1, sheenRoughness: 0.6, sheenColor: new Color(1, 1, 1) });
  const mat = new M(params);
  mat.name = prop ? 'people-prop' : 'people-figure';
  const defines = [prop ? 'P_PROP' : null, lerp ? 'P_LERP' : null, detail ? 'P_DETAIL' : null, dither ? 'P_DITHER' : null].filter(Boolean);
  mat.defines = Object.fromEntries(defines.map((d) => [d, '']));
  const palette = { value: opts.palette || Array.from({ length: 14 }, () => new Color(1, 1, 1)) };
  const glyph = { value: glyphTexture() };
  mat.userData.palette = palette;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPBones = atlas.uniform;
    shader.uniforms.uPPal = palette;
    shader.uniforms.uPGlyph = glyph;
    shader.vertexShader = patchVertex(shader.vertexShader, { depth: false });
    let f = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_PARS}`);
    f = f.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_PATTERN}`);
    f = f.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pRough;');
    f = f.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = pMetal;');
    f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef P_DETAIL
normal = pPerturb(-vViewPosition, normal, vec2(dFdx(pH), dFdy(pH)), faceDirection);
#endif`);
    if (physical) {
      f = f.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_SHEEN
material.sheenColor = pCol * pSheen;
material.sheenRoughness = 0.55;
#endif`);
    }
    shader.fragmentShader = f;
  };
  const key = `people:${defines.join(',')}:${physical ? 'phys' : 'std'}:v2`;
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
    const key = `people-depth:${prop ? 'prop' : 'fig'}:v2`;
    m.customProgramCacheKey = () => key;
    return m;
  };
  return { depth: mk(MeshDepthMaterial, {}), distance: mk(MeshDistanceMaterial, {}) };
}

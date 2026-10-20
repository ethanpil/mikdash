// GLSL shared by every texture generator program (GLSL ES 3.00, rendered into an MRT scratch target).
//
// A generator program = HEADER + LIB + <kind source defining `void surf(vec2 p, inout S s)`> + MAIN.
// `p` is the position inside the texture tile in METERS (tile = uTile): patterns are authored at physical
// scale and repeat seamlessly over the tile.
//
// Generators are deliberately LOOP-FREE and sample precomputed periodic basis maps (gen/basis.js) instead of
// evaluating noise in ALU: on ANGLE/Direct3D each program's compile cost grows with its instruction count and
// loops trigger an extra driver compile at first draw (measured 0.3–3 s per ALU-noise program on an HD 4600,
// ~0.05–0.2 s for the texture-driven form). The only loops left are the fixed 3x3 Sobel / ring in FINISH.
//
// Output: ONE packed RGBA32UI texel (read back by the finish pass with texelFetch). A single output matters on
// ANGLE/D3D11: the pixel-shader variant compiled at link time covers only the first output, so an MRT target
// forced a second, synchronous compile at the first draw of every generator.
//   x = albedo sRGB8 rgb + alpha8 (block-local distance for masonry sets, cut-out mask, or 1)
//   y = height16 (signed, ±uHRange) | roughness8 << 16 | ambient occlusion8 << 24
//   z = metalness8

export const VERTEX = /* glsl */`
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const HEADER = /* glsl */`
precision highp float;
precision highp int;
in vec2 vUv;
layout(location = 0) out highp uvec4 oP;

uniform vec2 uTile;      // tile size (m)
uniform vec2 uRes;       // pixels
uniform float uSeed;
uniform float uHRange;   // height range (m), signed
uniform vec4 uP0;
uniform vec4 uP1;
uniform vec4 uP2;
uniform vec4 uP3;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
uniform vec3 uC5;
uniform vec3 uC6;
uniform sampler2D tN;         // periodic fbm basis: 4 signed channels, 4 base cells per period
uniform sampler2D tV;          // periodic Voronoi basis, 16 cells per period: F1, border dist, cell hash, F2
uniform sampler2D tW;          // same with 5 cells per period (large cells)
uniform highp sampler2D tL;    // masonry lookup: texel (half-quantum, row) = (start m, length m, index, code)
uniform highp sampler2D tC;    // course table (uCourses > 0): texel (cm, 0) = (row, row start m, row height m, code)
uniform int uRows;
uniform int uCourses;
uniform float uRowH;
uniform float uDMax;
uniform float uQ;

#define PI 3.14159265
#define TAU 6.28318531

struct S { vec3 alb; float h; float rough; float metal; float ao; float a; };

vec2 gT; // pattern tile (m): uTile, or uTile.yx for rotated patterns
`;

export const LIB = /* glsl */`
// ---------- hashing (integer PCG; inputs non-negative) ----------
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
uint hu(ivec2 p) { return pcg(uint(p.x) + pcg(uint(p.y) ^ (uint(uSeed) * 2654435761u))); }
float h1(ivec2 p) { return float(hu(p)) * 2.3283064e-10; }
vec3 h3(ivec2 p) { uint a = hu(p); uint b = pcg(a); return vec3(float(a), float(b), float(pcg(b))) * 2.3283064e-10; }

// ---------- basis lookups ----------
// tile-periodic fbm, ~f cycles per meter per axis (rounded so the tile holds whole periods); o = decorrelating offset
vec4 nT(vec2 p, vec2 f, vec2 o) {
  vec2 k = max(vec2(1.0), floor(gT * f * 0.25 + 0.5));
  return texture(tN, p / gT * k + o);
}
// block-local fbm (period 4/f m), for patterns inside one stone/sheet/log
vec4 nL(vec2 lp, vec2 f, vec2 o) { return texture(tN, lp * f * 0.25 + o); }
// tile-periodic Voronoi with cells of ~c meters (per axis); returns F1, border distance, hash, F2 in cell units
vec4 vT(vec2 p, vec2 c, vec2 o) {
  vec2 n = gT / c;
  vec4 r = vec4(0.0);
  if (max(n.x, n.y) < 11.0) r = texture(tW, p / gT * max(vec2(1.0), floor(n / 5.0 + 0.5)) + o);
  else r = texture(tV, p / gT * max(vec2(1.0), floor(n / 16.0 + 0.5)) + o);
  return r;
}
vec4 vL(vec2 lp, vec2 c, vec2 o) { return texture(tV, lp / (c * 16.0) + o); }

// ---------- masonry blocks ----------
// h = the course height (uRowH, or the course table's row height)
struct Blk { float x0; float len; float lx; float ly; int row; int k; float code; float h; };
Blk blk(vec2 p) {
  Blk b;
  int r = clamp(int(floor(p.y / uRowH)), 0, uRows - 1);
  float y0 = float(r) * uRowH;
  float rh = uRowH;
  if (uCourses > 0) {
    vec4 c = texelFetch(tC, ivec2(clamp(int(floor(p.y * 100.0)), 0, uCourses - 1), 0), 0);
    r = int(c.x + 0.5);
    y0 = c.y;
    rh = c.z;
  }
  int w = textureSize(tL, 0).x;
  int i = clamp(int(floor(p.x / (uQ * 0.5))), 0, w - 1);
  vec4 t = texelFetch(tL, ivec2(i, r), 0);
  b.x0 = t.x;
  b.len = t.y;
  b.lx = p.x - t.x;
  b.ly = p.y - y0;
  b.row = r;
  b.k = int(t.z + 0.5);
  b.code = t.w;
  b.h = rh;
  return b;
}
vec3 blkHash(Blk b, int salt) { return h3(ivec2(b.row * 64 + b.k, salt)); }

// ---------- shared looks ----------
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float smax(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(a, b, h) + k * h * (1.0 - h); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// Marble in meters. local = block-local domain (one stone); otherwise tile-periodic.
// type 0 white (shayish), 1 blue-green banded (kochla), 2 veined (marmara).
vec4 nM(vec2 q, vec2 f, vec2 o, bool local) { return local ? nL(q, f, o) : nT(q, f, o); }
// a frequency along y (cycles/m) that stays periodic in the tile (free in the block-local domain)
float fM(float f, bool local) { return local ? f : max(1.0, floor(gT.y * f + 0.5)) / gT.y; }
vec3 marble(vec2 q, bool local, int type, vec3 base, vec3 vein, vec3 alt, out float vm) {
  // all fetches first (type may vary per stone: no texture reads in divergent branches)
  // domain warp from the SMOOTH channel (3 octaves): a warp with the rough 6-octave channels crinkled every vein
  // into centimetre squiggles that read as cracks or doodles
  vec4 w = nM(q, vec2(0.5), vec2(0.13, 0.71), local);
  float w2 = nM(q, vec2(0.5), vec2(0.57, 0.19), local).z;
  vec2 wq = q + vec2(w.z, w2) * (local ? vec2(0.8, 0.4) : vec2(0.5, 0.22));
  vec4 c = nM(wq, vec2(1.2), vec2(0.37, 0.11), local);
  vec4 cl = nM(q, vec2(0.45), vec2(0.83, 0.27), local);      // large soft clouds of tone
  float gate = nM(q, vec2(0.3, 0.5), vec2(0.71, 0.43), local).z;
  // veins: zero sets of noise sampled ANISOTROPICALLY (elongated along u, then warped): long, gently curving veins
  // that run roughly together, fade in and out, and branch into a finer family — not closed squiggles
  // (a periodic tile keeps whole cells per axis: ask for more cells across than along so it stays elongated)
  float n1 = nM(wq, local ? vec2(0.3, 1.25) : vec2(0.3, 2.1), vec2(0.61, 0.29), local).z;
  float n2 = nM(wq + vec2(w2, w.z) * 0.12, local ? vec2(0.8, 3.2) : vec2(0.7, 5.4), vec2(0.17, 0.53), local).z;   // smooth channel: wavy, not jagged
  float wv = nM(wq, vec2(1.4, 2.2), vec2(0.27, 0.05), local).z;
  vec4 kb = nM(q, vec2(0.7, 2.0), vec2(0.5, 0.3), local);
  float sn = nM(wq, vec2(0.6, 3.0), vec2(0.21, 0.83), local).z;
  vec4 gr = nM(q, vec2(26.0), vec2(0.43, 0.19), local);     // crystalline grain (all three marbles)
  float on = smoothstep(-0.25, 0.35, gate);
  // texel size (m): features narrower than a texel would alias into dashes on the low tiers — widen or fade them
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float grain = 0.022 * gr.w + 0.01 * gr.y;
  // soft clouds of tone (and, here and there, a faint grey veil) — the stone is never a flat plane of colour
  vec3 col = base * (1.0 + 0.035 * c.x + 0.04 * cl.y + grain - 0.035 * smoothstep(0.2, 0.8, cl.w))
           * mix(vec3(1.0), vec3(1.012, 1.0, 0.982), smoothstep(-0.3, 0.4, c.w));
  // a vein: a soft grey core inside a faint halo of FIXED width; the core thins and thickens a little along it
  // (0.75x..1.15x — a swelling core with a halo scaled with it left dark blobs where veins faded out: "a crack with a
  // stain"); core and halo fade out together, so a vein ends by dissolving, not in a smudge.
  // Contrast stays low (natural marble, not ink): the core blends at most ~40 % toward the vein tone (marmara).
  float wmul = 0.75 + 0.4 * smoothstep(-0.5, 0.5, wv);
  float vw0 = type == 2 ? 0.03 : 0.022;
  float vw = max(vw0 * wmul, tex * 2.5);
  float a1 = abs(n1);
  float core = 1.0 - smoothstep(0.0, vw, a1);
  core *= core;
  float halo = 1.0 - smoothstep(0.0, max(vw0 * 3.2, tex * 6.0), a1);
  halo *= halo;
  float fade = smoothstep(-0.45, 0.45, wv + 0.6 * cl.x);       // veins come and go along their length
  float hair = (1.0 - smoothstep(0.0, max(0.012, tex * 2.0), abs(n2))) * smoothstep(0.2, 0.7, gate) * smoothstep(0.25, 0.6, 0.0045 / tex);
  float vv = type == 2
    ? clamp((core * 0.4 + halo * 0.1) * (0.3 + 0.7 * on) * fade + hair * 0.08, 0.0, 1.0)
    : clamp((core * 0.13 + halo * 0.04) * on * fade + hair * 0.02, 0.0, 1.0);
  // kochla: layered bedding along a wavy coordinate, elongated along u (the course): broad soft tonal zones plus
  // thinner layers that fade in and out along their length, at LOW contrast (a pale blue-green-grey stone whose
  // layers read like the ripples of water); fine grains and sparse pale layers; the same crystalline grain
  float ky = q.y + 0.13 * w.z + 0.03 * w.x + 0.04 * c.y;
  float broad = smoothstep(-0.9, 0.9, sin(TAU * ky * fM(1.7, local) + 1.3 * kb.x) + 0.5 * kb.z);
  float tl = fract(ky * fM(6.1, local) + 0.35 * kb.y);
  float thin = smoothstep(0.55, 0.85, tl) * (1.0 - smoothstep(0.85, 0.99, tl)) * smoothstep(-0.25, 0.45, kb.z + 0.3 * c.x) * smoothstep(0.5, 1.5, 0.03 / tex);
  float band = clamp(0.5 * broad + 0.35 * thin, 0.0, 1.0);
  float speck = smoothstep(0.6, 0.9, gr.y * 0.8 + n2 * 0.35);
  vec3 kcol = mix(col, alt * (1.0 + 0.03 * c.x + grain), band) * (1.0 - 0.05 * speck);
  float st = smoothstep(0.25, 0.37, tl) * (1.0 - smoothstep(0.37, 0.48, tl)) * smoothstep(0.0, 0.6, kb.w + 0.4 * sn) * 0.3 * smoothstep(0.6, 1.6, 0.016 / tex);   // pale layers along the bedding
  kcol = mix(kcol, vein, st);
  vm = type == 1 ? st : vv;
  return type == 1 ? kcol : mix(col, vein, vv);
}
`;

export const MAIN = /* glsl */`
uint u8(float v) { return uint(clamp(v, 0.0, 1.0) * 255.0 + 0.5); }
void main() {
  gT = uTile;
  vec2 p = vUv * uTile;
  S s;
  s.alb = vec3(0.5);
  s.h = 0.0;
  s.rough = 0.5;
  s.metal = 0.0;
  s.ao = 1.0;
  s.a = 1.0;
  surf(p, s);
  vec3 c = clamp(s.alb, 0.0, 1.0);
  vec3 e = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  uint h16 = uint(clamp(s.h / uHRange * 0.5 + 0.5, 0.0, 1.0) * 65535.0 + 0.5);
  oP = uvec4(u8(e.r) | (u8(e.g) << 8) | (u8(e.b) << 16) | (u8(s.a) << 24),
             h16 | (u8(max(s.rough, 0.02)) << 16) | (u8(s.ao) << 24),
             u8(s.metal), 0u);
}
`;

// Finish pass: height -> tangent-space normal (Sobel), cavity AO; copies albedo / roughness / metalness.
// DETAIL variant packs a detail map: (normal.xy, albedo modulation, roughness modulation).
// PACK2 variant (terrain_blend layers): two maps — (albedo, height 0..1) and (normal.xy, roughness, AO): the blend
// shader needs each layer's height and fetches only two textures per layer.
export const FINISH = /* glsl */`
precision highp float;
precision highp int;
in vec2 vUv;
layout(location = 0) out vec4 o0;
#ifndef DETAIL
layout(location = 1) out vec4 o1;
#ifndef PACK2
layout(location = 2) out vec4 o2;
#endif
#endif
uniform highp usampler2D tP;
uniform ivec2 uSize;
uniform vec2 uTexel;     // meters per texel (x, y)
uniform float uHRange;
uniform vec3 uAO;        // radius (m), depth (m), amount
uniform float uNormalGain;

// integer wrap (a > -8m): float division misrounds on some GPUs (896/896 floored to 0 on the HD 4600)
ivec2 wrapI(ivec2 a, ivec2 m) { return (a + m * 8) % m; }
float H(ivec2 q) {
  uint y = texelFetch(tP, wrapI(q, uSize), 0).y;
  return (float(y & 65535u) / 65535.0 - 0.5) * 2.0 * uHRange;
}
float b8(uint v, int sh) { return float((v >> uint(sh)) & 255u) / 255.0; }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float tl = H(c + ivec2(-1, 1)), tc = H(c + ivec2(0, 1)), tr = H(c + ivec2(1, 1));
  float ml = H(c + ivec2(-1, 0)), mc = H(c), mr = H(c + ivec2(1, 0));
  float bl = H(c + ivec2(-1, -1)), bc = H(c + ivec2(0, -1)), br = H(c + ivec2(1, -1));
  float dx = ((tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl)) / (8.0 * uTexel.x);
  float dy = ((tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br)) / (8.0 * uTexel.y);
  vec3 n = normalize(vec3(-dx * uNormalGain, -dy * uNormalGain, 1.0));
  uvec4 P = texelFetch(tP, c, 0);
  vec3 e = vec3(b8(P.x, 0), b8(P.x, 8), b8(P.x, 16));
  vec4 A = vec4(mix(e / 12.92, pow((e + 0.055) / 1.055, vec3(2.4)), step(0.04045, e)), b8(P.x, 24));
  vec4 R = vec4(b8(P.y, 24), b8(P.y, 16), b8(P.z, 0), 1.0);
  // cavity: how far this texel sits below the average of two rings around it
  vec2 rp = uAO.x / uTexel;
  vec2 rq = rp * 0.45;
  float avg = H(c + ivec2(round(vec2(rp.x, 0.0)))) + H(c + ivec2(round(vec2(-rp.x, 0.0))))
            + H(c + ivec2(round(vec2(0.0, rp.y)))) + H(c + ivec2(round(vec2(0.0, -rp.y))))
            + H(c + ivec2(round(rp * 0.707))) + H(c + ivec2(round(-rp * 0.707)))
            + H(c + ivec2(round(vec2(rp.x, -rp.y) * 0.707))) + H(c + ivec2(round(vec2(-rp.x, rp.y) * 0.707)))
            + H(c + ivec2(round(vec2(rq.x, rq.y * 0.4)))) + H(c + ivec2(round(vec2(-rq.x * 0.4, rq.y))))
            + H(c + ivec2(round(vec2(-rq.x, -rq.y * 0.4)))) + H(c + ivec2(round(vec2(rq.x * 0.4, -rq.y))));
  avg /= 12.0;
  float cav = 1.0 - clamp((avg - mc) / max(uAO.y, 1e-5), 0.0, 1.0) * uAO.z;
#ifdef DETAIL
  o0 = vec4(n.xy * 0.5 + 0.5, A.r, R.g);
#elif defined(PACK2)
  o0 = vec4(A.rgb, clamp(mc / uHRange * 0.5 + 0.5, 0.0, 1.0));
  o1 = vec4(n.xy * 0.5 + 0.5, R.g, R.r * cav);
#else
  o0 = A;
  o1 = vec4(n.xy * 0.5 + 0.5, 0.0, 1.0);
  o2 = vec4(R.r * cav, R.g, R.b, 1.0);
#endif
}
`;

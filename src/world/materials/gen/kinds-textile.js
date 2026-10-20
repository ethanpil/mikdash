// Generator kinds: textiles, hides, rope (see kinds.js for the conventions).

export const TEXTILE_KINDS = {
  // Woven textiles. Plain weave of round, plied threads: shesh (six-ply linen); for the parochet every cord
  // twists all four materials — techelet, argaman, tola'at shani and shesh (Shekalim 8:5; Yoma 71b).
  // No figures are woven in (none attested for the Second-Temple parochot).
  // materials-2-fix: every per-thread variation (thickness slubs, dye tone, the linen ply's share) changes along
  // the thread within a few centimetres and is decorrelated thread to thread — slow variations constant along long
  // threads, and a tile-scale drift of the linen share, read as a plaid across the 1 m tile.
  weave: {
    hRange: 0.003, ao: [0.002, 0.0002, 0.6],
    src: /* glsl */`
// uP0: x pitch (m), y thread fill, z slub amount, w multicolour plies (1) or single colour (0)
// uP1: x twist pitch (m), y fuzz, z rough, w gap darkening
// uP2: x ply count, y weave (0 plain, 1 2/2 twill), z linen ply share (multicolour), w per-cord share jitter
// uP3: x ply blend toward the mean (wool fuzz)
// uC0 linen colour; uC1..uC4 ply colours (techelet, argaman, tola'at shani, shesh)
float threadH(float across, float along, float up, float fw) {
  float x = across / fw;
  float cr = sqrt(max(0.0, 1.0 - x * x));
  float un = up > 0.5 ? (0.72 + 0.28 * sin(PI * along)) : (0.38 - 0.25 * sin(PI * along));
  return cr * un;
}
void surf(vec2 p, inout S s) {
  vec2 c = p / uP0.x;
  ivec2 ci = ivec2(floor(c));
  vec2 f = c - vec2(ci);
  float fuzz = nT(p, vec2(2.0 / uP0.x), vec2(0.0)).w;
  // plain weave: over 1 under 1; 2/2 twill: over 2 under 2, stepping one per row (floats twice as long)
  bool twill = uP2.y > 0.5;
  int k4 = (ci.x + ci.y) & 3;
  float up = twill ? float(k4 < 2) : float(((ci.x + ci.y) & 1) == 0);
  float aW = twill ? (float(k4 & 1) + f.y) * 0.5 : f.y;   // position along the current float, warp / weft
  float aF = twill ? (float(k4 & 1) + f.x) * 0.5 : f.x;
  // per-thread slubs: each thread its own random place in the noise, varying along it every few cm (whole periods
  // per tile: 12 / m along the thread)
  float kA = max(1.0, floor(uTile.y * 12.0 + 0.5)) / uTile.y;
  float kB = max(1.0, floor(uTile.x * 12.0 + 0.5)) / uTile.x;
  vec4 sW = textureLod(tN, vec2(h1(ivec2(ci.x, 33)), p.y * kA * 0.25), 0.0);
  vec4 sF = textureLod(tN, vec2(p.x * kB * 0.25, h1(ivec2(ci.y, 35))), 0.0);
  float tw = 1.0 + uP0.z * sW.x;
  float tf = 1.0 + uP0.z * sF.y;
  float hw = threadH(f.x * 2.0 - 1.0, aW, up, uP0.y * tw);
  float hf = threadH(f.y * 2.0 - 1.0, aF, 1.0 - up, uP0.y * tf);
  bool showWarp = hw >= hf;
  float h = max(hw, hf);
  float across = showWarp ? (f.x * 2.0 - 1.0) : (f.y * 2.0 - 1.0);
  float along = showWarp ? p.y : p.x;
  int thr = showWarp ? ci.x : ci.y + 4096;
  // ply helix: half a turn across the visible face of the cord; each float its own phase jitter (with a twist pitch
  // commensurate with the float spacing every float of a thread showed the same ply: stripes, a plaid)
  float ph = along / uP1.x + across * 0.25 + h1(ivec2(thr, 77)) + 0.35 * h1(ci + ivec2(7, 13));
  float tn = showWarp ? sW.z : sF.z;
  vec3 col;
  if (uP0.w > 0.5) {
    // four plies — techelet, argaman, tola'at shani, shesh — the (finer) linen ply taking a smaller share, jittered a
    // little cord to cord (no drift across the cloth)
    float wl = clamp(uP2.z * (1.0 + uP2.w * (h1(ivec2(thr, 91)) - 0.5) * 2.0), 0.03, 0.5);
    float c1 = (1.0 - wl) / 3.0;
    float fr = fract(ph);
    float dB = min(min(fr, 1.0 - fr), min(abs(fr - c1), min(abs(fr - 2.0 * c1), abs(fr - 3.0 * c1))));
    h *= 0.84 + 0.16 * smoothstep(0.0, 0.07, dB);
    col = fr < c1 ? uC1 : (fr < 2.0 * c1 ? uC2 : (fr < 3.0 * c1 ? uC3 : uC4));
    vec3 mean = (uC1 + uC2 + uC3) * c1 + uC4 * wl;
    col = mix(col, mean, uP3.x);                       // wool fuzz scatters light across the ply boundaries
    col *= 1.0 + 0.05 * tn;
    // cords narrower than ~4 texels alias into dots and a checker: fade the structure into a fine heather of the
    // same mean colour (sets give the parochet enough texels per cord on every tier)
    float texel = max(uTile.x / uRes.x, uTile.y / uRes.y);
    float res = smoothstep(3.0, 4.5, uP0.x / texel);
    vec3 heather = mean * (1.0 + 0.1 * fuzz + 0.06 * tn + 0.08 * (h1(ivec2(floor(p / texel))) - 0.5));
    col = mix(heather, col, res);
    h = mix(0.55 + 0.1 * fuzz, h, res);
  } else {
    float nPl = max(uP2.x, 2.0);
    float g = abs(fract(ph * nPl) - 0.5) * 2.0;
    h *= 0.86 + 0.14 * smoothstep(0.0, 0.35, 1.0 - g);
    col = uC0 * (1.0 + 0.04 * (h1(ivec2(thr, 5)) - 0.5) + 0.03 * tn);
  }
  col *= 1.0 + 0.05 * fuzz * uP1.y;
  float gap = 1.0 - smoothstep(0.02, 0.25, h);
  col *= 1.0 - uP1.w * gap;
  s.alb = col;
  s.h = h * uP0.x * 0.35 + fuzz * uP0.x * 0.02 * uP1.y;
  s.rough = uP1.z + 0.05 * fuzz;
  s.ao = 1.0 - 0.67 * uP1.w * gap;
}`,
  },

  // Salted hides (Lishkat HaParvah, where the hides of the offerings were salted — Middot 5:3): the flesh side of a
  // fresh hide — the cream-tan connective tissue in fibrous sheets whose fibres run one way per region, a membranous
  // satin sheen, fat patches, soft wrinkles and folds — under drifts and scattered grains of coarse salt.
  // (materials-2-fix: no vessel network — it read as veined pink marble.)
  hide: {
    hRange: 0.02, ao: [0.012, 0.003, 0.5],
    src: /* glsl */`
// uP0: x wrinkle amp (m), y fibre amp, z salt cover, w salt grain (m)
// uC0 flesh light (cream-tan), uC1 flesh dark, uC2 fat, uC3 salt, uC4 membrane sheen tint
void surf(vec2 p, inout S s) {
  vec4 w = nT(p, vec2(1.0), vec2(0.0));
  vec2 q = p + w.xy * 0.06;
  float wr1 = nT(q, vec2(2.0, 9.0), vec2(0.2, 0.5)).z;
  float wr2 = nT(q, vec2(7.0, 2.2), vec2(0.6, 0.1)).z;
  vec4 m = nT(q, vec2(2.5), vec2(0.4, 0.8));
  vec4 rg = vT(p, vec2(0.18), vec2(0.13, 0.77));       // regions of one fibre direction
  // fibres along u, along v or along a diagonal (diagonal coordinates stay periodic in a SQUARE tile)
  vec2 dq = vec2(q.x + q.y, q.y - q.x);
  float fu = nT(q, vec2(4.0, 150.0), vec2(0.31, 0.43)).y;
  float fv = nT(q, vec2(150.0, 4.0), vec2(0.57, 0.19)).y;
  float fd = nT(dq, vec2(3.0, 110.0), vec2(0.71, 0.29)).y;
  float cls = rg.z * 3.0;
  float fb1 = cls < 1.0 ? fu : (cls < 2.0 ? fv : fd);
  float fb2 = nT(q, vec2(90.0), vec2(0.23, 0.67)).x;
  vec4 sg = vT(p, vec2(uP0.w), vec2(0.7, 0.2));
  vec4 sg2 = vT(p + 0.13, vec2(uP0.w * 0.6), vec2(0.27, 0.61));
  vec4 sc = nT(p, vec2(1.6), vec2(0.15, 0.45));
  vec4 g = nT(p, vec2(70.0), vec2(0.5, 0.5));
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float rid = pow(1.0 - abs(wr1), 4.0) * 0.7 + pow(1.0 - abs(wr2), 5.0) * 0.4;
  float fib = uP0.y * (0.65 * fb1 + 0.35 * fb2) * smoothstep(0.03, 0.2, rg.y);
  float salt = uP0.z * smoothstep(-0.1, 0.5, sc.x + 0.3 * m.y);
  float vis = smoothstep(1.2, 2.5, uP0.w / tex);
  // salt grains: cubic-ish crystals, bright faces, a dark rim, scattered thinly beyond the drifts
  float gr1 = step(0.3, sg.z) * (1.0 - smoothstep(0.22, 0.4, sg.x));
  float gr2 = step(0.55, sg2.z) * (1.0 - smoothstep(0.2, 0.38, sg2.x));
  float grain = max(gr1, gr2 * 0.8) * clamp(salt * 1.4 + 0.08 * step(0.85, sg.z), 0.0, 1.0) * vis;
  float rim = max(gr1, gr2) * smoothstep(0.25, 0.42, max(sg.x, sg2.x)) * clamp(salt * 1.4, 0.0, 1.0) * vis;
  s.h = rid * uP0.x + w.z * 0.003 + fib * 0.0004 + grain * uP0.w * 0.45 + salt * 0.0008 + g.x * 0.0002;
  vec3 col = mix(uC0, uC1, smoothstep(-0.4, 0.6, m.x) * 0.7);
  col = mix(col, uC2, smoothstep(0.35, 0.85, m.z) * 0.45);
  col *= 1.0 - 0.05 * rid + 0.06 * fib;
  col = mix(col, uC4, smoothstep(0.2, 0.8, m.w) * 0.12);
  col = mix(col, uC3 * (0.92 + 0.1 * g.y), clamp(salt * 0.5 + grain * 0.55, 0.0, 1.0));
  col *= 1.0 - 0.25 * rim;
  s.alb = col;
  s.rough = mix(0.5 + 0.12 * m.y - 0.06 * smoothstep(0.2, 0.8, m.w), 0.78 - 0.18 * grain, clamp(salt + grain, 0.0, 1.0));
  s.ao = 1.0 - 0.2 * rim;
}`,
  },

  // Hemp rope: strands laid diagonally (45 degrees in u/v: SQUARE tile), fibres along each strand, grooves between.
  rope: {
    hRange: 0.008, ao: [0.004, 0.002, 0.5],
    src: /* glsl */`
// uP0: x strand period along u+v (m), y fibre amp (m), z strand height (m)
// uC0 hemp light, uC1 hemp dark
void surf(vec2 p, inout S s) {
  vec2 d = vec2(p.x + p.y, p.y - p.x);
  float t = d.x / uP0.x;
  float fs = fract(t + 0.03 * nT(p, vec2(12.0), vec2(0.1, 0.2)).x);
  float prof = sqrt(clamp(1.0 - pow(fs * 2.0 - 1.0, 2.0), 0.0, 1.0));
  float fib = nT(d, vec2(180.0, 6.0), vec2(0.3, 0.6)).y;
  vec4 n = nT(p, vec2(8.0), vec2(0.6, 0.2));
  s.h = prof * uP0.z + fib * uP0.y * prof;
  s.alb = mix(uC1, uC0, smoothstep(0.1, 0.8, prof)) * (1.0 + 0.12 * fib + 0.06 * n.x);
  s.rough = 0.9;
  s.ao = 0.55 + 0.45 * smoothstep(0.0, 0.5, prof);
}`,
  },
};

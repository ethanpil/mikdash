// Generator kinds: metals (see kinds.js for the conventions). The Kodesh relief is in kinds-relief.js.

export const METAL_KINDS = {
  // Beaten gold sheets (rikuei zahav, Shekalim 4:4) over walls and doors: overlapping sheets with fine seams,
  // hammer dishing, per-sheet burnish. Albedo is a near-white tone map; colour comes from material.color.
  goldplate: {
    hRange: 0.003, ao: [0.01, 0.0004, 0.4],
    src: /* glsl */`
// uP0: x seam gap (m), y overlap lip (m), z hammer dish depth (m), w dish cell (m)
// uP1: x rough base, y per-sheet rough variation, z sheet waviness (m), w burnish
// uP2: x per-sheet tone variation
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  vec3 bh = blkHash(b, 505);
  vec2 lp = vec2(b.lx, b.ly) + bh.xy * 29.0;
  vec4 dv = vL(lp, vec2(uP0.w), vec2(0.0));
  vec4 n = nL(lp, vec2(4.0), vec2(0.3, 0.3));
  vec4 wv = nL(lp, vec2(3.0), vec2(0.61, 0.17));   // beaten sheet over carved wood: waviness over 20-40 cm
  float burn = nL(lp, vec2(9.0, 54.0), vec2(0.1, 0.7)).y;
  float ex0 = b.lx;
  float ex1 = b.len - b.lx;
  float ey0 = b.ly;
  float ey1 = uRowH - b.ly;
  float e = min(min(ex0, ex1), min(ey0, ey1));
  float seam = 1.0 - smoothstep(uP0.x * 0.5, uP0.x * 1.5, e);
  float lip = 1.0 - smoothstep(0.0, 0.006, min(ex0, ey1));
  float dish = uP0.z * (dv.x * dv.x - 0.3) * (0.6 + 0.8 * dv.z);
  float wav = uP1.z * (wv.x + 0.4 * wv.y) * smoothstep(0.0, 0.04, e);   // held flat along the seams
  s.h = wav + n.x * 0.0002 + dish + lip * uP0.y - seam * 0.0007;
  float tone = 0.97 + uP2.x * (bh.y - 0.5) * 2.0 + 0.01 * burn;
  vec3 col = vec3(tone) * mix(vec3(1.0), vec3(1.0, 0.994, 0.985), bh.x);
  s.alb = mix(col, col * 0.4, seam);
  float r = uP1.x + uP1.y * (bh.z - 0.5) * 2.0 + 0.03 * burn * uP1.w + 0.04 * (1.0 - smoothstep(0.0, 0.6, dv.x));
  s.rough = mix(r, 0.6, seam);
  s.metal = mix(1.0, 0.5, seam);
  s.ao = 1.0 - 0.5 * seam;
  s.a = b.lx / uDMax;
}`,
  },

  // Cast / raised / hammered metal: vessels (gold of the grades, silver), Corinthian bronze, copper.
  metal: {
    hRange: 0.0012, ao: [0.01, 0.0002, 0.3],
    src: /* glsl */`
// uP0: x dish depth (m), y dish cell (m), z polish scratch amp (m), w rough base
// uP1: x tarnish, y tarnish rough, z verdigris, w rough variation
// uP2: x casting/planishing waviness (m), y its frequency (1/m), z polishing-streak rough amp, w patina in recesses
// uP3: x oxide film (tarnish areas partly dielectric), y tarnish evenness (0 patchy .. 1 an even film),
//      z rubbed bright: the ridges between hammer dishes and the high spots of the fine relief (hand wear)
// uC0 clean tone, uC1 tarnish tone, uC2 verdigris albedo
void surf(vec2 p, inout S s) {
  vec4 dv = vT(p, vec2(uP0.y), vec2(0.0));
  float scr = nT(p, vec2(2.0, 160.0), vec2(0.3, 0.6)).y;
  vec4 n = nT(p, vec2(2.0), vec2(0.0));
  float tn = smoothstep(-0.2, 0.8, nT(p, vec2(1.2), vec2(0.5, 0.2)).z);
  float vgn = nT(p, vec2(3.0), vec2(0.8, 0.3)).y;
  vec4 wv = nT(p, vec2(uP2.y), vec2(0.6, 0.15));
  float strk = nT(p, vec2(1.5, 45.0), vec2(0.15, 0.8)).y;      // polishing streaks (along u)
  vec4 nf = nT(p, vec2(28.0), vec2(0.36, 0.72));               // fine film variation
  float wav = wv.x + 0.35 * wv.z;
  float rec = uP2.w * smoothstep(0.1, 0.9, -wav);                // low spots keep a faint darker patina
  s.h = uP0.x * (dv.x * dv.x - 0.3) * (0.6 + 0.8 * dv.z) + uP0.z * scr + n.x * 0.0005 + n.z * 0.0004 + uP2.x * wav;
  float tar = uP1.x * mix(tn, 0.86 + 0.08 * tn + 0.06 * nf.x, uP3.y);   // uP3.y: an even film instead of patches
  // hand wear: the film is rubbed off along the ridges between the hammer dishes (dish borders, high) — a fine bright
  // net on hammered copper, not blotches
  float ridge = smoothstep(0.5, 0.72, dv.x) * smoothstep(0.0, 0.6, nf.y + 0.6 * n.y);
  tar *= 1.0 - uP3.z * ridge;
  vec3 col = mix(uC0 * (1.0 + 0.02 * scr), uC1 * (1.0 + 0.05 * nf.z), tar);
  col *= 1.0 - 0.08 * rec;
  float vg = uP1.z * smoothstep(0.35, 0.75, vgn);
  s.alb = mix(col, uC2, vg);
  s.metal = 1.0 - vg - uP3.x * tar;   // uP3.x: a thick oxide film (worn kitchen copper) is partly dielectric
  s.rough = uP0.w + uP1.w * n.y + 0.03 * scr + tar * uP1.y + vg * 0.6 + uP2.z * strk + 0.05 * rec;
  s.ao = 1.0 - 0.06 * rec;
}`,
  },

  // Dark forged iron (kalya orev blade, flaying hooks, knives — kept off the altar): black oxide, hammer
  // marks, rust where weathered.
  iron: {
    hRange: 0.003, ao: [0.01, 0.0006, 0.5],
    src: /* glsl */`
// uP0: x scale relief, y rust amount, z pitting, w hammer marks;  uC0 oxide tone, uC1 rust, uC2 dark rust
void surf(vec2 p, inout S s) {
  vec4 n = nT(p, vec2(3.0), vec2(0.0));
  vec4 hv = vT(p, vec2(0.02), vec2(0.0));
  float rn = nT(p, vec2(2.5), vec2(0.4, 0.7)).y;
  vec4 f = nT(p, vec2(20.0), vec2(0.2, 0.2));
  vec4 pv = vT(p, vec2(0.008), vec2(0.5, 0.1));
  float rc = nT(p, vec2(8.0), vec2(0.9, 0.5)).x;
  float ham = uP0.w * (hv.x * hv.x - 0.3);
  float rust = uP0.y * smoothstep(0.05, 0.5, rn + 0.15 * f.x);
  float pit = uP0.z * rust * step(0.7, pv.z) * (1.0 - smoothstep(0.2, 0.45, pv.x));
  s.h = n.x * uP0.x + ham * 0.0006 + rust * 0.0004 * f.w - pit * 0.0008;
  vec3 iron = uC0 * (1.0 + 0.15 * n.y);
  s.alb = mix(iron, mix(uC1, uC2, smoothstep(-0.3, 0.5, rc)), rust);
  s.metal = mix(0.75, 0.0, rust);
  s.rough = mix(0.5 + 0.1 * n.w, 0.92, rust);
  s.ao = 1.0 - 0.4 * pit;
}`,
  },
};

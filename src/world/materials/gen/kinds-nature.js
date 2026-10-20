// Generator kinds: ground cover, foliage, water, close-range detail, food and resin (see kinds.js).

export const NATURE_KINDS = {
  // Ground for terrain_blend's soil and vegetation layers: early-November Judean hill ground. Dry grass in tufts
  // that cluster and thin out across the ground, combed one way (elliptical along u), each with a dark base of
  // stems and shade and paler blade tips fraying its outline; low grey-olive dwarf-shrub cushions (batha) whose
  // undersides and the soil round them are shaded; limestone grit; a sparse haze of new green after the first rains.
  // uP1.w > 0: cultivated ground in early November — ploughed after the first rains: soil with clods, shallow,
// irregular furrow traces (that spacing; an ard scratches, it does not turn deep rows), straw remnants, a few weeds.
  // materials-2-fix: tuft cover clumps at ~2 m, tufts vary 3x in size, their outlines fray; no round spots.
  grass: {
    hRange: 0.12, ao: [0.04, 0.02, 0.5],
    src: /* glsl */`
// uP0: x clump scale (m), y grass cover, z shrub share, w new green
// uP1: x grit density, y grass height (m), z shrub size (m), w stubble row spacing (m; 0 none)
// uC0 soil, uC1 dry grass (light), uC2 dry grass (dark: stems, shade), uC3 shrub grey-olive, uC4 grit, uC5 new green
void surf(vec2 p, inout S s) {
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  vec4 wp = nT(p, vec2(1.2), vec2(0.0));
  // every lookup below repeats every few tens of cm (4 noise cells / 16 Voronoi cells a period): a warp by a field of
  // the tile's own period, larger than those repeats, shuffles them out of register (no lattice of marks at 20 m)
  vec4 wL = nT(p, vec2(0.6), vec2(0.29, 0.61));
  vec2 q = p + wL.xy * 0.45 + wp.xy * 0.05;
  vec4 gv = vT(q, vec2(0.022), vec2(0.37, 0.83));
  vec4 mo = nT(p, vec2(0.45), vec2(0.6, 0.2));                      // where the grass grows thicker (~2 m)
  vec4 cl = nT(q, vec2(1.0 / uP0.x), vec2(0.17, 0.43));              // clumps
  vec4 cl2 = nT(q, vec2(2.6 / uP0.x), vec2(0.71, 0.29));
  vec4 sh = nT(q, vec2(1.0 / uP1.z), vec2(0.53, 0.11));              // shrub cushions
  vec4 n = nT(p, vec2(3.0), vec2(0.25, 0.65));
  vec4 g = nT(p, vec2(60.0), vec2(0.8, 0.1));
  // blades: thin strokes combed along u, a second set crossing at a slant (periodic diagonal coordinates)
  vec2 dq = vec2(q.x + q.y, q.y - q.x);          // 45 degrees (periodic in a SQUARE tile)
  vec2 dq2 = vec2(q.x - q.y, q.x + q.y);
  float bl = nT(q, vec2(12.0, 90.0), vec2(0.21, 0.4)).y;
  float bl2 = mix(nT(dq, vec2(9.0, 70.0), vec2(0.61, 0.1)).x, nT(dq2, vec2(9.0, 70.0), vec2(0.13, 0.77)).y, step(0.0, nT(p, vec2(1.5), vec2(0.9, 0.2)).y));
  float bsel = smoothstep(-0.2, 0.3, nT(p, vec2(3.0), vec2(0.44, 0.19)).z);
  float twig = nT(p, vec2(140.0), vec2(0.12, 0.88)).x;
  float green = nT(p, vec2(25.0), vec2(0.9, 0.35)).z;
  float stb = nT(q, vec2(2.0, 1.0), vec2(0.37, 0.53)).y;
  float strokes = smoothstep(-0.3, 0.6, mix(max(bl, bl2 * 0.6), max(bl2, bl * 0.6), bsel));
  // clumps of dry grass: irregular, 20-60 cm, clustered; their edges fray along the blades
  float cover = clamp(uP0.y + 0.4 * mo.x, 0.0, 0.95);
  // (an nT field repeats every 4 / f m — the basis has 4 base cells a period — so the clump field mixes in octaves
  // whose period is the tile and half of it; alone it repeated every 1.5 m, a lattice of marks at 20 m)
  float cf = cl.x * 0.5 + cl2.y * 0.2 + 0.45 * mo.w + 0.3 * nT(q, vec2(1.1), vec2(0.83, 0.57)).x;
  float thr = mix(0.7, -0.7, cover);
  float clump = smoothstep(thr - 0.05, thr + 0.12, cf + 0.35 * (strokes - 0.5));
  float inner = smoothstep(thr + 0.05, thr + 0.45, cf);                // the dense middle of a clump: its shaded base
  // shrub cushions (batha): low domes of fine grey twigs, a darker lower rim, a shadow ring on the soil
  float sth = mix(0.75, 0.2, uP0.z * 4.0);
  float sf = sh.w * 0.7 + 0.35 * mo.z + 0.15 * n.x + 0.1 * twig;
  float shrub = step(0.001, uP0.z) * smoothstep(sth, sth + 0.06, sf);
  float sdome = step(0.001, uP0.z) * smoothstep(sth, sth + 0.4, sh.w);
  float sring = step(0.001, uP0.z) * smoothstep(sth - 0.18, sth, sf) * (1.0 - shrub);
  // cultivated: shallow furrow traces along u, wandering and fading in and out; straw remnants along them
  float rowsOn = step(0.001, uP1.w);
  float ry = p.y / max(uP1.w, 0.01) + 0.45 * wL.x + 0.2 * wp.x + 0.22 * n.z;   // rows wobble at metre scale
  float rowP = abs(fract(ry) - 0.5) * 2.0;                            // 0 on a ridge, 1 in the furrow between
  float rowFade = smoothstep(-0.3, 0.5, stb + 0.4 * mo.y);
  float stub = rowsOn * (1.0 - smoothstep(0.1, 0.35, rowP + 0.3 * strokes)) * smoothstep(0.3, 0.8, stb + 0.4 * n.y) * (0.35 + 0.65 * strokes) * 0.3;
  float furrow = rowsOn * smoothstep(0.15, 1.0, rowP) * rowFade;
  float grass = max(clump * (0.5 + 0.5 * strokes) * mix(1.0, 0.3, rowsOn), stub) * (1.0 - shrub);
  // grit (~1 cm stones): faded where a texel is larger than a stone (medium, low): there it aliased into bright single texels
  float grit = step(1.0 - uP1.x, gv.z) * (1.0 - smoothstep(0.25, 0.4, gv.x)) * (1.0 - grass) * (1.0 - shrub) * (1.0 - smoothstep(0.012, 0.03, tex));
  s.h = n.x * 0.006 + grass * uP1.y * (0.35 + 0.65 * strokes) * (1.0 - 0.3 * inner) + sdome * 0.08 * (0.85 + 0.15 * twig)
      + grit * 0.004 + g.x * 0.0006 - furrow * 0.004;
  vec3 soil = uC0 * (1.0 + 0.08 * n.y + 0.05 * g.y) * (1.0 - 0.05 * furrow);
  soil *= 1.0 - 0.25 * sring - 0.15 * smoothstep(thr - 0.25, thr, cf) * (1.0 - clump);
  // blades pale straw at their tips, the base of a clump a dark tangle of stems in shade
  vec3 gc = mix(uC2, uC1, 0.2 + 0.8 * strokes) * (0.9 + 0.15 * mo.z);
  gc = mix(gc, uC2 * 0.6, inner * (1.0 - strokes) * 0.75);
  vec3 col = mix(soil, gc, grass);
  vec3 sc = uC3 * (0.72 + 0.36 * smoothstep(-0.3, 0.5, twig)) * mix(0.6, 1.05, sdome);
  col = mix(col, sc, shrub);
  col = mix(col, uC4 * (0.85 + 0.25 * fract(gv.z * 9.1)), grit);
  float sprout = uP0.w * smoothstep(0.55, 0.85, green) * (1.0 - shrub) * (1.0 - 0.7 * grass);
  col = mix(col, uC5, sprout * 0.55);
  s.alb = col;
  s.rough = 0.92 + 0.05 * grass - 0.05 * grit;
  s.ao = (1.0 - 0.3 * shrub * (1.0 - sdome) - 0.3 * inner * grass) * (1.0 - 0.25 * sring);
}`,
  },

  // Olive leaves (Olea europaea): narrow lanceolate leaves ~6 x 1.4 cm, tapered at both ends, in sprays — each
  // spray's leaves share a direction (one of four: along u, v or a diagonal; a SQUARE tile) — with dark gaps into
  // the canopy between sprays. Upper side dark grey-green and glossy, underside only a little paler and matte:
  // the silver of an olive is mostly its glossy upper sides reflecting the sky and the turned undersides, not
  // white blobs (materials-2-fix). uP3.x = 0: a canopy surface (opaque); 1: a cut-out cluster card (alpha = leaves).
  leaves: {
    hRange: 0.03, ao: [0.025, 0.01, 0.6],
    src: /* glsl */`
// uP0: x leaf cell length (m), y leaf cell width (m), z leaf cover, w underside share
// uP1: x spray cell (m), y canopy openness, z card spray radius (cell units)
// uC0 upper side, uC1 underside, uC2 interior shadow
void surf(vec2 p, inout S s) {
  bool card = uP3.x > 0.5;
  vec2 c = uP0.xy;
  vec2 cd = c * 1.41421356;
  vec2 d1 = vec2(p.x + p.y, p.y - p.x);
  vec2 d2 = vec2(p.x - p.y, p.x + p.y);
  vec4 cl = vT(p, vec2(uP1.x), vec2(0.27, 0.66));      // sprays
  vec4 v0 = vT(p, c, vec2(0.0));
  vec4 v1 = vT(p.yx, c, vec2(0.37, 0.11));
  vec4 v2 = vT(d1, cd, vec2(0.61, 0.53));
  vec4 v3 = vT(d2, cd, vec2(0.19, 0.83));
  vec4 n = nT(p, vec2(4.0), vec2(0.2, 0.4));
  vec4 g = nT(p, vec2(90.0), vec2(0.5, 0.5));
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  // the spray's direction: one of the four layers dominates in each spray, a second one weakly
  float k0 = cl.z < 0.25 ? 1.0 : 0.55;
  float k1 = cl.z >= 0.25 && cl.z < 0.5 ? 1.0 : 0.55;
  float k2 = cl.z >= 0.5 && cl.z < 0.75 ? 1.0 : 0.55;
  float k3 = cl.z >= 0.75 ? 1.0 : 0.55;
  // inside a spray leaves are dense; toward its edge they thin out into the dark gaps between sprays
  float inSpray = card ? 1.0 - smoothstep(uP1.z * 0.75, uP1.z, cl.x + 0.08 * n.x)
                       : 1.0 - uP1.y * smoothstep(0.3, 0.75, cl.x + 0.12 * n.y);
  float cover = uP0.z * inSpray;
  // a leaf: the Voronoi cell (4:1) shrunk from its border — an elongated hexagon pointed at both ends — rounded by F1
  float lw = max(0.07, tex / min(c.x, c.y) * 1.0);
  float l0 = step(fract(v0.z * 3.7), cover * k0) * smoothstep(lw * 0.5, lw * 1.5, v0.y) * (1.0 - smoothstep(0.38, 0.46, v0.x));
  float l1 = step(fract(v1.z * 3.7 + 0.27), cover * k1) * smoothstep(lw * 0.5, lw * 1.5, v1.y) * (1.0 - smoothstep(0.38, 0.46, v1.x));
  float l2 = step(fract(v2.z * 3.7 + 0.54), cover * k2) * smoothstep(lw * 0.5, lw * 1.5, v2.y) * (1.0 - smoothstep(0.38, 0.46, v2.x));
  float l3 = step(fract(v3.z * 3.7 + 0.81), cover * k3) * smoothstep(lw * 0.5, lw * 1.5, v3.y) * (1.0 - smoothstep(0.38, 0.46, v3.x));
  float h0 = l0 * (0.4 + 0.6 * fract(v0.z * 7.3)) * (0.7 + 0.3 * smoothstep(0.0, 0.3, v0.y));
  float h1 = l1 * (0.4 + 0.6 * fract(v1.z * 7.3 + 0.13)) * (0.7 + 0.3 * smoothstep(0.0, 0.3, v1.y));
  float h2 = l2 * (0.4 + 0.6 * fract(v2.z * 7.3 + 0.26)) * (0.7 + 0.3 * smoothstep(0.0, 0.3, v2.y));
  float h3 = l3 * (0.4 + 0.6 * fract(v3.z * 7.3 + 0.39)) * (0.7 + 0.3 * smoothstep(0.0, 0.3, v3.y));
  vec4 top = h0 >= h1 ? vec4(h0, v0.z, v0.y, 0.0) : vec4(h1, v1.z + 1.0, v1.y, 0.0);
  vec4 top2 = h2 >= h3 ? vec4(h2, v2.z + 2.0, v2.y, 0.0) : vec4(h3, v3.z + 3.0, v3.y, 0.0);
  top = top.x >= top2.x ? top : top2;
  float best = top.x;
  float id = top.y;
  float leaf = smoothstep(0.0, 0.05, best);
  float under = step(fract(id * 3.1), uP0.w);
  // the midrib: a faint line along the leaf (the cell's long axis has the largest border distance)
  float mid = smoothstep(0.3, 0.45, top.z);
  vec3 lc = mix(uC0, uC1, under) * (0.86 + 0.24 * fract(id * 11.3)) * (1.0 - 0.06 * mid * (1.0 - under));
  lc *= 1.0 + 0.04 * g.x;
  // deeper in the canopy (low leaves) a little darker
  lc *= 0.82 + 0.18 * smoothstep(0.3, 0.9, best);
  vec3 bg = uC2 * (0.8 + 0.3 * n.z);
  s.alb = mix(bg, lc, leaf);
  s.h = best * 0.014 + leaf * top.z * 0.0015 + n.x * 0.004 * inSpray;
  s.rough = mix(0.88, mix(0.52 + 0.08 * fract(id * 5.7), 0.72, under), leaf);
  s.ao = mix(card ? 1.0 : 0.3, 1.0, leaf * (0.55 + 0.45 * best));
  s.a = card ? leaf : 1.0;
}`,
  },

  // Still water (kiyor, mikvaot, the amah channel): ripple normals only; colour from the material.
  water: {
    hRange: 0.002, ao: [0.01, 0.0001, 0.0],
    src: /* glsl */`
void surf(vec2 p, inout S s) {
  s.h = nT(p, vec2(1.2, 1.8), vec2(0.0)).x * 0.0012 + nT(p, vec2(4.0, 3.0), vec2(0.3, 0.6)).y * 0.0005;
  s.alb = vec3(1.0);
  s.rough = uP0.x;
}`,
  },

  // Micro detail maps (packed normal.xy, albedo and roughness modulation) blended in close to the camera.
  // Mode 4 (d_comb): the strokes of a toothed (comb) chisel on a drafted margin — parallel grooves ~2.4 mm apart in
  // strokes 3-6 cm long running along v, each stroke shifted a little; the patch turns it to run across the
  // margin it dresses.
  detail: {
    hRange: 0.0006, ao: [0.001, 0.0001, 0.0], detail: true,
    src: /* glsl */`
// uP0.x mode: 0 stone, 1 metal, 2 wood, 3 cloth, 4 comb-chisel strokes
void surf(vec2 p, inout S s) {
  int m = int(uP0.x + 0.5);
  vec4 v = vT(p, vec2(m == 1 ? 0.006 : 0.0016), vec2(0.0));
  vec4 pv = vT(p, vec2(0.004), vec2(0.5, 0.5));
  vec4 g = nT(p, vec2(m == 3 ? 300.0 : (m == 2 ? 80.0 : 120.0)), vec2(0.3, 0.1));
  vec4 a1 = nT(p, m == 1 ? vec2(8.0, 900.0) : vec2(10.0, 1400.0), vec2(0.2, 0.3));
  float scr2 = nT(p, vec2(700.0, 12.0), vec2(0.6, 0.1)).x;
  vec4 cn = nT(p, vec2(40.0, 6.0), vec2(0.17, 0.71));
  float pit = step(0.9, pv.z) * (1.0 - smoothstep(0.15, 0.4, pv.x));
  // comb strokes: columns 2.5 cm wide (whole columns per tile), strokes along v of a column-hashed length
  float col = floor(p.x / (uTile.x / 8.0));
  float L = uTile.y / (4.0 + floor(h1(ivec2(int(col), 7)) * 3.0));
  float sy = p.y / L + h1(ivec2(int(col), 9));
  float si = floor(sy);
  float sf = fract(sy);
  float shift = h1(ivec2(int(col) * 31 + int(si), 13)) * 0.0024;
  float tooth = fract((p.x + shift + 0.0003 * cn.x) / 0.0024);
  float grooveC = 1.0 - smoothstep(0.12, 0.42, abs(tooth - 0.5));
  float strokeEnd = smoothstep(0.0, 0.12, sf) * (1.0 - smoothstep(0.85, 1.0, sf));
  float depth = (0.6 + 0.4 * h1(ivec2(int(col) * 17 + int(si), 21))) * strokeEnd;
  float h = 0.0;
  float al = 0.5;
  float ro = 0.5;
  if (m == 0) {
    h = (v.z - 0.5) * 0.00008 + g.x * 0.00012 - pit * 0.0002;
    al = 0.5 + (v.z - 0.5) * 0.25 + g.x * 0.12 - pit * 0.15;
    ro = 0.5 + (v.z - 0.5) * 0.2 + pit * 0.2;
  } else if (m == 1) {
    h = (v.x * v.x - 0.3) * 0.00006 + a1.y * 0.000012 + scr2 * 0.000006;
    al = 0.5 + a1.y * 0.04;
    ro = 0.5 + a1.y * 0.18 + (v.z - 0.5) * 0.1;
  } else if (m == 2) {
    h = a1.y * 0.00012 + g.x * 0.00004;
    al = 0.5 + a1.y * 0.12;
    ro = 0.5 + a1.y * 0.15;
  } else if (m == 3) {
    h = g.x * 0.00004;
    al = 0.5 + g.x * 0.08;
    ro = 0.5 + g.x * 0.1;
  } else {
    h = -grooveC * depth * 0.00016 + g.x * 0.00003 + (v.z - 0.5) * 0.00003;
    al = 0.5 - grooveC * depth * 0.05 + g.x * 0.04;
    ro = 0.5 - 0.06 * (1.0 - grooveC) * depth + 0.04 * grooveC;
  }
  s.alb = vec3(al);
  s.rough = ro;
  s.h = h;
}`,
  },

  // Unleavened loaf crust (the showbread was matzah — Menachot 5:1): pale baked dough, golden crust, toasted brown
  // spots and patches where it touched the oven, small blisters, fine cracks, a dusting of flour.
  crust: {
    hRange: 0.008, ao: [0.006, 0.002, 0.4],
    src: /* glsl */`
// uP0: x blister cell (m), y toast amount, z flour dusting, w cracks
// uC0 dough (pale), uC1 golden crust, uC2 toasted brown, uC3 flour
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(4.0), vec2(0.0));
  vec4 bv = vT(p + wp.xy * 0.01, vec2(uP0.x), vec2(0.3, 0.6));
  vec4 tv = nT(p, vec2(5.0), vec2(0.71, 0.22));
  vec4 tv2 = nT(p, vec2(18.0), vec2(0.15, 0.85));
  vec4 cv = vT(p, vec2(0.05), vec2(0.5, 0.1));
  vec4 g = nT(p, vec2(120.0), vec2(0.4, 0.4));
  vec4 fl = nT(p, vec2(3.0), vec2(0.9, 0.6));
  float blister = step(0.55, bv.z) * sqrt(clamp(1.0 - bv.x / (0.38 + 0.1 * fract(bv.z * 7.0)), 0.0, 1.0));
  float toast = uP0.y * clamp(smoothstep(0.15, 0.75, tv.x + 0.35 * tv2.y) + blister * 0.5 * smoothstep(0.2, 0.8, 1.0 - bv.x), 0.0, 1.0);
  float crack = uP0.w * (1.0 - smoothstep(0.0, 0.03, cv.y)) * step(0.6, cv.z);
  float flour = uP0.z * smoothstep(0.2, 0.8, fl.x + 0.3 * g.y) * (1.0 - 0.6 * blister);
  s.h = blister * 0.0025 + wp.z * 0.0015 + g.x * 0.0002 - crack * 0.0008;
  vec3 col = mix(uC0, uC1, smoothstep(-0.4, 0.5, tv.z) * 0.7 + 0.3 * blister);
  col = mix(col, uC2 * (0.85 + 0.3 * tv2.z), toast);
  col *= 1.0 - 0.3 * crack;
  col = mix(col, uC3, flour * 0.7);
  col *= 1.0 + 0.04 * g.z;
  s.alb = col;
  s.rough = 0.78 + 0.1 * flour - 0.08 * toast;
}`,
  },

  // A heap of frankincense (levonah) tears: irregular rounded lumps of resin 0.5-2.5 cm, pale yellow to amber,
  // translucent — light passing through the thin edges makes them glow paler and more saturated than the thick
  // middles (the subsurface cue, carried in the albedo) — dusted with their own white bloom, glassy where broken.
  lumps: {
    hRange: 0.02, ao: [0.006, 0.004, 0.6],
    src: /* glsl */`
// uP0: x tear cell (m), y tear height (m), z frosting, w shade between tears
// uC0 resin pale, uC1 resin amber, uC2 bloom white, uC3 gap, uC4 translucent edge glow
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(10.0), vec2(0.0));
  vec4 wq = nT(p, vec2(30.0), vec2(0.41, 0.73));
  vec4 v = vT(p + wp.xy * uP0.x * 0.35 + wq.xy * uP0.x * 0.1, vec2(uP0.x), vec2(0.0));
  vec4 v2 = vT(p + 0.41 + wp.zw * uP0.x * 0.3, vec2(uP0.x * 0.55), vec2(0.5, 0.5));
  vec4 g = nT(p, vec2(150.0), vec2(0.3, 0.7));
  vec4 fr = nT(p, vec2(40.0), vec2(0.65, 0.15));
  vec4 br = nT(p, vec2(12.0), vec2(0.13, 0.37));
  float r1 = 0.36 + 0.14 * fract(v.z * 7.1);
  float e1 = clamp(1.0 - v.x / r1, 0.0, 1.0) * smoothstep(0.0, 0.08, v.w - v.x);
  float d1 = sqrt(e1) * (0.65 + 0.55 * fract(v.z * 3.3));
  float r2 = 0.38 + 0.1 * fract(v2.z * 5.3);
  float e2 = clamp(1.0 - v2.x / r2, 0.0, 1.0) * smoothstep(0.0, 0.08, v2.w - v2.x) * step(0.35, v2.z);
  float d2 = sqrt(e2) * (0.6 + 0.4 * fract(v2.z * 2.9)) * step(0.7, v2.z);
  float h1v = d1 * uP0.y;
  float h2v = d2 * uP0.y * 0.6;
  bool top1 = h1v >= h2v;
  float id = top1 ? v.z : v2.z;
  float dm = top1 ? d1 : d2;
  float body = smoothstep(0.0, 0.12, dm);
  // broken faces: flat glassy facets on some tears
  float facet = step(0.62, fract(id * 9.7)) * smoothstep(-0.1, 0.4, br.x);
  s.h = max(h1v, h2v) * (1.0 - 0.25 * facet * smoothstep(0.4, 0.9, dm)) + g.x * 0.0002;
  vec3 resin = mix(uC0, uC1, smoothstep(0.3, 1.0, fract(id * 13.7)) * 0.85);
  resin *= mix(0.86, 1.0, smoothstep(0.35, 0.9, dm));         // thick middles a little deeper
  float edge = (1.0 - smoothstep(0.08, 0.45, dm)) * body;       // thin rims: light through the resin
  resin = mix(resin, uC4, edge * 0.55);
  float frost = uP0.z * smoothstep(-0.3, 0.5, fr.x + 0.4 * g.y) * (1.0 - facet);
  resin = mix(resin, uC2, frost * 0.5);
  s.alb = mix(uC3, resin, body);
  s.rough = mix(0.9, mix(mix(0.22, 0.6, frost), 0.1, facet), body);
  s.ao = mix(1.0 - uP0.w, 1.0, body);
}`,
  },
};

// Generator kinds: masonry, stone, lime, ground (see kinds.js for the conventions).

export const STONE_KINDS = {
  // Herodian marble ashlar: courses of white (shayish), blue-green (kochla) and veined (marmara) marble,
  // one course set out and one drawn in (apik shefa v'a'eil shefa — Bava Batra 4a), left unplastered.
  // Drafted margins with a slightly raised, pointed boss (uP1.x = 1) or plain fine-dressed faces (uP1.x = 0, the
  // inner-face variant). Row code = colour type * 2 + set-out flag. Courses follow the layout's course table when
  // it has one (b.h = that course's height).
  // materials-2-fix: the dressing is sized to what the texture resolves — the boss is pointed with 1.5–3 mm pits on
  // ~2–3.4 cm cells (≥ 3 texels on high; faded below), rough (0.8) against the smoother combed margin (0.55); the
  // comb strokes themselves are millimetre-scale and live in the close-range detail layer (d_comb, patch.js), masked
  // to the margin by this roughness step. The bevel is 3–5 cm, its line hand-cut; no margin brightening, no cavity ring.
  herodian: {
    hRange: 0.09, ao: [0.012, 0.012, 0.1],
    src: /* glsl */`
// uP0: x margin width (m), y boss raise (m), z joint half-width (m), w course set-out (m)
// uP1: x drafted-margin boss on/off, y boss pit depth (m), z weathering, w vein scale
// uP2: x joint depth (m), y arris rounding (m), z sheltered band under a set-out course (m), w its sky occlusion
// uP3: x boss bevel width (m), y stone-to-stone tone, z stone-to-stone hue (warm cream .. cool grey), w vein slant
// uC0..2 course colours (shayish, kochla, marmara), uC3..5 their veins/streaks, uC6 kochla band colour
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  float rh = b.h;
  float outF = mod(b.code, 2.0);
  int ct = int(floor(b.code * 0.5 + 0.01));
  vec3 bh = blkHash(b, 101);
  vec3 bk = blkHash(b, 131);
  vec3 bm = blkHash(b, 151);
  float ex = min(b.lx, b.len - b.lx);
  float ey = min(b.ly, rh - b.ly);
  vec2 lp = vec2(b.lx, b.ly) + bh.xy * 37.0;
  vec4 nA = nL(lp, vec2(9.0), vec2(0.0));
  vec4 nB = nL(lp, vec2(1.3), vec2(0.31, 0.17));
  vec4 nC = nL(lp, vec2(38.0), vec2(0.73, 0.41));
  vec4 nD = nL(lp, vec2(3.5), vec2(0.13, 0.89));
  // pointed dressing of the boss: pits of a point struck at a slant, on ~3.4 cm and ~2.2 cm cells
  vec4 pk = vL(lp, vec2(0.034), vec2(0.23, 0.57));
  vec4 pk2 = vL(lp + vec2(0.37, 0.11), vec2(0.022), vec2(0.61, 0.11));
  vec4 sw = nT(p, vec2(9.0, 0.35), vec2(0.37, 0.13));
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  // dry hairline joints: arrises rounded a few mm, chipped here and there (more at block corners)
  float corner = 1.0 - smoothstep(0.0, 0.15, max(ex, ey));
  float chip = 0.004 * smoothstep(0.6, 0.9, nA.z) + 0.006 * corner * smoothstep(0.35, 0.8, nA.w);
  float e = min(ex, ey) + 0.001 * nA.x - chip;
  float face = smoothstep(uP0.z - 0.0005, uP0.z + max(0.0005, tex * 0.5), e);
  float tA = clamp((e - uP0.z) / uP2.y, 0.0, 1.0);
  float arris = sqrt(tA * (2.0 - tA));
  // drafted margin: a flat combed band 8-14 cm, its width different on each side of the stone; then a bevel 3-5 cm
  // wide whose line wanders a few mm (cut by hand, not ruled) up to the boss, raised 1-1.5 cm
  vec4 mws = uP0.x * (0.75 + 0.5 * vec4(bh.z, bm.x, bm.y, bm.z));
  float wob = 0.005 * nD.x + 0.0025 * nA.y + 0.0012 * nC.z;
  float em = min(min(b.lx - mws.x, b.len - b.lx - mws.y), min(b.ly - mws.z, rh - b.ly - mws.w)) + wob - chip * 0.5;
  float bw = uP3.x * (0.8 + 0.45 * bk.z);
  float bev = clamp(em / bw, 0.0, 1.0);
  // a chamfer: nearly straight, its two arrises only slightly rounded (a uniform lit / shaded band, not a line)
  float boss = uP1.x * mix(bev, bev * bev * (3.0 - 2.0 * bev), 0.35);
  float marg = uP1.x * (1.0 - boss);
  float fine = max(boss, 1.0 - uP1.x);
  // pits: bowl-shaped, of varied depth, present in most cells; faded below ~3 texels a cell (low / medium tiers),
  // where the detail layer carries the fine pecking near the camera instead
  // (a bowl: depth falls smoothly to its rim — a crisp edge reads as a printed dot)
  float r1 = 0.28 + 0.1 * fract(pk.z * 7.3);
  float q1 = clamp(1.0 - (pk.x * pk.x) / (r1 * r1), 0.0, 1.0);
  float pit1 = step(0.5, pk.z) * q1 * q1 * (0.5 + 0.8 * fract(pk.z * 13.1));
  float r2 = 0.26 + 0.08 * fract(pk2.z * 5.9);
  float q2 = clamp(1.0 - (pk2.x * pk2.x) / (r2 * r2), 0.0, 1.0);
  float pit2 = step(0.62, pk2.z) * q2 * q2 * (0.45 + 0.6 * fract(pk2.z * 11.7));
  float vis1 = smoothstep(2.2, 3.8, 0.034 / tex);
  float vis2 = smoothstep(2.2, 3.8, 0.022 / tex);
  // not on the bevel's crest (pits there cut it into a dashed line)
  float onBoss = boss * smoothstep(0.0, 0.015, em - bw) * uP1.x;
  float pit = (pit1 * vis1 + pit2 * vis2 * 0.6) * onBoss;
  float pitA = pit;
  float plane = outF * uP0.w;
  // the boss face is hand-dressed, not a plane: a few mm of undulation; the margin is flat to a fraction of a mm
  float hBoss = uP0.y * (0.75 + 0.5 * bh.x) + 0.0025 * nD.y + 0.0015 * nB.z - pit * uP1.y;
  float hFace = plane + boss * hBoss + nB.x * 0.0012 * (0.4 + fine) + marg * 0.0004 * nC.y
              + (1.0 - uP1.x) * (nC.w * 0.0002 + nD.y * 0.001);
  s.h = mix(plane - uP2.x, hFace, arris * face);
  // stone-to-stone variation: each block from its own part of the bed — value, and a warm cream .. cool grey cast
  // (kochla stones vary more: paler and deeper blocks break the course into a shimmer, not a stripe)
  float tone = 1.0 + uP3.y * (ct == 1 ? 2.2 : 1.0) * (bh.x - 0.5) * 2.0;
  vec3 hue = mix(vec3(1.025, 1.0, 0.96), vec3(0.975, 1.0, 1.03), bk.x);
  vec3 base = (ct == 0 ? uC0 : (ct == 1 ? uC1 : uC2)) * tone * mix(vec3(1.0), hue, uP3.z);
  vec3 vein = ct == 0 ? uC3 : (ct == 1 ? uC4 : uC5);
  float vm;
  // veins at a slant of their own in every stone; kochla's bedding stays near the course line
  vec2 mq = rot2(lp * uP1.w, (bk.y - 0.5) * uP3.w * (ct == 1 ? 0.2 : 1.0));
  vec3 col = marble(mq, true, ct, base, vein, uC6 * tone * mix(vec3(1.0), hue, uP3.z), vm);
  // kochla: some blocks nearly grey, about a third of them pale — close to the shayish in value with only a hint
  // of green: the course shimmers instead of reading as a painted band
  if (ct == 1) {
    col = mix(col, vec3(lum(col)) * vec3(1.01, 1.0, 0.985), 0.5 * bk.z * bk.z);
    col = mix(col, mix(uC0 * tone, col, 0.35), smoothstep(0.6, 0.78, fract(bk.z * 3.7 + bh.y)) * 0.7);
  }
  // the pointed boss reads a touch stippled where its pits resolve; the smoother margin is NOT lighter (a pale margin
  // drew a grout-like outline round every block from 20 m); the hairline joint only mildly dark
  col *= 1.0 - 0.025 * pitA - 0.01 * marg;
  col = mix(col * 0.85, col, face);
  col *= 1.0 + 0.012 * nC.y;
  // restrained weathering (the building was new): a set-out course sheds rain over its foot, so the drawn-in course
  // below is sheltered along its top (a faint warm dust patina); dust washed off each set-out course's ledge runs
  // down its face in a few faint streaks
  float shel = (1.0 - outF) * (1.0 - smoothstep(0.0, 0.18, rh - b.ly + 0.02 * nB.y));
  col = mix(col, col * vec3(0.955, 0.94, 0.91), uP1.z * shel);
  float streak = outF * smoothstep(0.25, 0.7, sw.x) * (1.0 - smoothstep(0.0, 0.5, rh - b.ly)) * uP1.z;
  col = mix(col, col * vec3(0.97, 0.962, 0.95), streak);
  // the set-out course above hides part of the sky from a narrow band along a drawn-in course's top (ambient
  // occlusion only; the real shadow is geometry's)
  float band = (1.0 - outF) * (1.0 - smoothstep(0.0, uP2.z, rh - b.ly + 0.006 * nB.y));
  s.alb = col;
  // roughness: pointed boss 0.78-0.84, combed margin 0.52-0.58 (this step is also the detail layer's margin mask),
  // a plain fine-dressed face 0.65 (world-4: the top of fine-dressed ashlar's 0.5-0.65, render-env-2-fix)
  float rB = 0.8 + 0.035 * nC.w + 0.03 * pit;
  float rM = 0.55 + 0.025 * nC.w;
  float rP = 0.65 + 0.02 * nC.w;
  float rF = uP1.x > 0.5 ? mix(rM, rB, boss) : rP;
  s.rough = mix(0.86, rF + (ct == 1 ? 0.015 : 0.0) - 0.03 * vm + 0.02 * shel + 0.02 * streak, face);
  s.ao = mix(0.8, 1.0, face) * (1.0 - uP2.w * band) * (1.0 - 0.06 * pit);
  s.a = b.lx / uDMax;
}`,
  },

  // Generic dressed limestone ashlar (chambers, inner faces): tooth-chiselled faces, tight joints.
  ashlar: {
    hRange: 0.03, ao: [0.04, 0.012, 0.6],
    src: /* glsl */`
// uP0: x joint half-width, y face bulge, z tooling amp, w arris width
// uP1: x lime-wash cover (0 bare stone .. 1 thick wash), y wash-stroke relief (m), z joint fill by the wash
// uC0..2 palette, uC3 joint colour, uC4 lime colour
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  vec3 bh = blkHash(b, 202);
  float ex = min(b.lx, b.len - b.lx);
  float ey = min(b.ly, uRowH - b.ly);
  vec2 lp = vec2(b.lx, b.ly) + bh.xy * 41.0;
  vec4 nA = nL(lp, vec2(10.0), vec2(0.0));
  float wash = uP1.x;
  // arrises worn and chipped here and there, more at the block corners
  float corner = 1.0 - smoothstep(0.0, 0.15, max(ex, ey));
  float e = min(ex, ey) + uP0.x * 0.8 * nA.x - 0.003 * smoothstep(0.62, 0.9, nA.z) - 0.005 * corner * smoothstep(0.4, 0.8, nA.w);
  // the wash rounds the arrises and fills the joints (wider, softer transition)
  float face = smoothstep(uP0.x, uP0.x + uP0.w * (1.0 + 3.0 * wash), e);
  vec2 c = vec2(b.lx / b.len, b.ly / uRowH) - 0.5;
  float pil = (1.0 - dot(c, c) * 2.0) * uP0.y * (0.6 + 0.8 * bh.z);
  vec2 rp = rot2(lp, bh.x > 0.5 ? 0.6 : -0.6);
  float strokes = nL(rp, vec2(55.0, 6.6), vec2(0.4, 0.2)).y;
  vec4 g = nL(lp, vec2(30.0), vec2(0.7, 0.9));
  vec4 big = nL(lp, vec2(1.6), vec2(0.2, 0.6));
  // brush / cloth strokes of the wash: horizontal, starting and stopping
  float wst = nT(p, vec2(1.4, 22.0), vec2(0.62, 0.34)).y * smoothstep(-0.1, 0.5, nT(p, vec2(2.5, 1.0), vec2(0.18, 0.77)).x);
  // thick wash bridges the joints in places (tile-space noise, so both sides of a joint agree)
  float bridge = wash * uP1.z * smoothstep(-0.3, 0.5, nT(p, vec2(2.0), vec2(0.71, 0.33)).x);
  float jd = mix(0.012, 0.003, uP1.z * wash) * (1.0 - 0.85 * bridge);
  s.h = mix(-jd, pil + (strokes * uP0.z + g.x * uP0.z * 0.5) * (1.0 - 0.7 * wash) + wst * uP1.y * wash, face);
  vec3 base = bh.z < 0.45 ? uC0 : (bh.z < 0.8 ? uC1 : uC2);
  base *= 0.94 + 0.12 * bh.y;
  vec3 col = base * (1.0 + 0.07 * big.x + 0.04 * g.x + 0.02 * strokes);
  col = mix(col, col * vec3(1.02, 0.95, 0.86), smoothstep(0.3, 0.8, big.w) * 0.45);
  // the wash: near-opaque lime, a little thinner on the high spots (stone tone faintly through)
  float thin = smoothstep(0.2, 0.9, big.y + 0.5 * strokes) * 0.12;
  vec3 lime = uC4 * (1.0 + 0.02 * wst + 0.012 * g.x + 0.015 * big.z);
  col = mix(col, lime, wash * (1.0 - thin));
  // the dry joint: dust and shadow a little darker than the stone either side, not a drawn line
  col = mix(mix(mix(mix(uC3, col * 0.8, 0.5), lime * 0.95, wash * uP1.z), lime, bridge), col, face);
  s.alb = col;
  s.rough = mix(mix(0.92, 0.74 + 0.05 * g.x, face), 0.88 + 0.04 * g.x, wash);
  s.ao = mix(mix(mix(0.5, 0.8, wash * uP1.z), 1.0, bridge), 1.0, face);
  s.a = b.lx / uDMax;
}`,
  },

  // Large fitted paving slabs in rows. Mount: weathered pale marble; Azarah: "precious stones" (avanim
  // yekarot, Rambam BhB 1:10) — fine marble slabs, tight joints, polished by bare feet.
  paving: {
    hRange: 0.03, ao: [0.04, 0.01, 0.6],
    src: /* glsl */`
// uP0: x joint half-width, y joint depth, z arris width, w pit amount
// uP1: x stone (0 limestone, 1 marble), y rough base, z tilt (m), w undulation (m)
// uP2: x vein amount, y rough variation, z stain amount, w wear (tooling worn away: 0 fresh .. 1 polished)
// uC0..2 palette, uC3 joint fill, uC4 vein colour
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  vec3 bh = blkHash(b, 303);
  float ex = min(b.lx, b.len - b.lx);
  float ey = min(b.ly, uRowH - b.ly);
  vec2 lp = vec2(b.lx, b.ly) + bh.xy * 43.0;
  vec4 nA = nL(lp, vec2(11.0), vec2(0.0));
  vec4 nB = nL(lp, vec2(1.7), vec2(0.3, 0.1));
  vec4 nM2 = nL(lp, vec2(6.0), vec2(0.8, 0.45));
  vec4 g = nL(lp, vec2(35.0), vec2(0.6, 0.2));
  float strokes = nL(rot2(lp, bh.z * 3.14), vec2(70.0, 7.0), vec2(0.2, 0.5)).y;
  // edges: rounded and chipped (chips larger near corners)
  float corner = 1.0 - smoothstep(0.0, 0.2, max(ex, ey));
  float e = min(ex, ey) + uP0.x * 0.9 * nA.x - 0.012 * corner * smoothstep(0.0, 0.6, nA.y);
  float face = smoothstep(uP0.x, uP0.x + uP0.z, e);
  float tilt = ((b.lx / b.len - 0.5) * (bh.x - 0.5) + (b.ly / uRowH - 0.5) * (bh.y - 0.5)) * 2.0 * uP1.z;
  // weathering: worn hollows, pitting, half-worn tooling
  float pit = uP0.w * smoothstep(0.55, 0.8, -nM2.w + 0.4 * g.y);
  float wear = uP2.w;
  float relief = tilt + nB.x * uP1.w + nM2.x * 0.003 + strokes * 0.0007 * (1.0 - wear) + g.x * 0.0004 - pit * 0.003;
  s.h = mix(-uP0.y, relief, face);
  vec3 base = bh.z < 0.45 ? uC0 : (bh.z < 0.8 ? uC1 : uC2);
  base *= 0.9 + 0.18 * bh.x;
  base = mix(base, base * vec3(1.03, 1.0, 0.95), smoothstep(0.5, 1.0, fract(bh.y * 7.7)));
  float vm;
  vec3 mcol = marble(lp, true, bh.y < 0.8 ? 0 : 2, base, uC4, base, vm);
  vec3 lcol = base * (1.0 + 0.08 * nB.y + 0.05 * g.x);
  vec3 col = uP1.x > 0.5 ? mix(base, mcol, uP2.x) : lcol;
  vm *= uP1.x * uP2.x;
  // mottling, dust in the low spots and pits, stains
  col *= 1.0 + 0.08 * nM2.y + 0.05 * g.w + 0.03 * strokes * (1.0 - wear);
  float low = smoothstep(0.0, 0.6, -nM2.x);
  col = mix(col, uC3 * 0.95, low * 0.15 + pit * 0.5);
  col *= 1.0 - 0.1 * smoothstep(0.6, 0.9, g.z + 0.3 * nM2.z) * (1.0 - wear);
  col *= 1.0 - uP2.z * smoothstep(0.15, 0.75, nB.w);
  float edgeDirt = (1.0 - smoothstep(uP0.x, uP0.x + 0.04, e)) * 0.18;
  col = mix(col, uC3, edgeDirt);
  col = mix(mix(uC3, col * 0.85, 0.35), col, face);
  s.alb = col;
  s.rough = mix(0.95, uP1.y + uP2.y * (bh.y - 0.5) * 2.0 + 0.06 * g.x - 0.08 * vm + 0.12 * pit + 0.05 * nB.w + 0.05 * low - 0.06 * wear * (1.0 - low), face);
  s.ao = mix(0.45, 1.0, face) * (1.0 - 0.25 * pit);
  s.a = b.lx / uDMax;
}`,
  },

  // Monolithic dressed hard limestone (steps): fine claw/comb tooling across u, sparse pits.
  stone: {
    hRange: 0.006, ao: [0.01, 0.0015, 0.5],
    src: /* glsl */`
// uP0: x tooling amp (m), y pit amount, z rough base, w rough variation
// uC0 base, uC1 alternate (warmer) patches
void surf(vec2 p, inout S s) {
  vec4 n = nT(p, vec2(1.2), vec2(0.0));
  vec4 g = nT(p, vec2(30.0), vec2(0.3, 0.7));
  float strokes = nT(p, vec2(3.0, 40.0), vec2(0.5, 0.2)).y;
  vec4 v = vT(p, vec2(0.018), vec2(0.0));
  float pit = uP0.y * (1.0 - smoothstep(0.0, 0.3, v.x)) * step(0.85, v.z);
  s.h = strokes * uP0.x + g.x * uP0.x * 0.4 + n.x * 0.001 - pit * 0.0015;
  vec3 col = mix(uC0, uC1, 0.5 * smoothstep(0.0, 0.7, nT(p, vec2(0.8), vec2(0.3, 0.3)).z));
  col *= 1.0 + 0.07 * n.y + 0.04 * g.x;
  col = mix(col, col * 0.8, pit);
  s.alb = col;
  s.rough = uP0.z + uP0.w * n.w + 0.05 * strokes + 0.1 * pit;
}`,
  },

  // Fired clay (terracotta): Herodian oil lamps and jugs, wheel-thrown. Fine horizontal wheel striations (along u),
  // a thin slip that thins on the high spots, firing clouds (reduction greys, buff and orange), grit and small voids,
  // burnished in places. Muted earthen colour (the old orange read as plastic).
  clay: {
    hRange: 0.003, ao: [0.006, 0.0006, 0.5],
    src: /* glsl */`
// uP0: x wheel-line amp (m), y grit, z slip cover, w burnish
// uC0 body (fired clay), uC1 slip, uC2 firing cloud (reduced, grey-brown), uC3 grit (pale), uC4 buff (oxidised high)
void surf(vec2 p, inout S s) {
  vec4 n = nT(p, vec2(1.5), vec2(0.0));
  vec4 cl = nT(p, vec2(0.7), vec2(0.4, 0.7));          // firing clouds
  float wl = nT(p, vec2(1.2, 260.0), vec2(0.25, 0.61)).y;   // wheel striations: long along u, ~4 mm apart
  float wl2 = nT(p, vec2(2.4, 90.0), vec2(0.71, 0.13)).x;   // throwing ridges, ~1 cm
  vec4 gv = vT(p, vec2(0.006), vec2(0.37, 0.53));       // grit and voids
  vec4 g = nT(p, vec2(80.0), vec2(0.5, 0.5));
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float vis = smoothstep(1.5, 3.0, 0.006 / tex);
  float grit = uP0.y * step(0.86, gv.z) * (1.0 - smoothstep(0.2, 0.42, gv.x)) * vis;
  float voidM = uP0.y * step(gv.z, 0.05) * (1.0 - smoothstep(0.15, 0.35, gv.x)) * vis;
  s.h = uP0.x * (wl * 0.6 + wl2 * 1.4) + n.x * 0.0005 + g.x * 0.00008 + grit * 0.0002 - voidM * 0.0004;
  float slip = uP0.z * clamp(smoothstep(-0.4, 0.3, n.y + 0.5 * wl2) , 0.0, 1.0);
  vec3 col = mix(uC0, uC1, slip * 0.75);
  col = mix(col, uC4, smoothstep(0.2, 0.8, cl.x) * 0.35);
  col = mix(col, uC2, smoothstep(0.35, 0.9, cl.w + 0.25 * n.z) * 0.55);
  col *= 1.0 + 0.04 * wl2 + 0.03 * g.y;
  col = mix(col, uC3, grit * 0.8);
  col *= 1.0 - 0.35 * voidM;
  s.alb = col;
  float bur = uP0.w * smoothstep(0.1, 0.7, n.w + 0.4 * wl2);
  s.rough = 0.86 - 0.22 * bur - 0.04 * slip + 0.04 * grit;
  s.ao = 1.0 - 0.4 * voidM;
}`,
  },

  // Monolithic polished marble (columns, tables, slabs): type 0 shayish, 1 kochla, 2 marmara.
  marble: {
    hRange: 0.002, ao: [0.01, 0.0005, 0.3],
    src: /* glsl */`
// uP0: x type, z rough base, w rough variation;  uC0 base, uC1 vein, uC2 band (kochla)
void surf(vec2 p, inout S s) {
  float vm;
  vec3 col = marble(p, false, int(uP0.x + 0.5), uC0, uC1, uC2, vm);
  vec4 g = nT(p, vec2(40.0), vec2(0.2));
  vec4 n = nT(p, vec2(2.0), vec2(0.1, 0.4));
  col *= 1.0 + 0.02 * g.x;
  s.alb = col;
  s.h = g.x * 0.0002 + n.z * 0.0004 - vm * 0.0001;
  s.rough = uP0.z + uP0.w * n.y - 0.05 * vm;
}`,
  },

  // Lime plaster (sid) and the lime-concrete roof fill (ma'azivah, Middot 4:6).
  plaster: {
    hRange: 0.006, ao: [0.02, 0.002, 0.5],
    src: /* glsl */`
// uP0: x trowel ridge (m), y grain (m), z cracks, w aggregate
// uP1: x stain amount, y rough base;  uC0 base, uC1 stain, uC2 aggregate
void surf(vec2 p, inout S s) {
  vec4 v = vT(p, vec2(0.38), vec2(0.0));
  float ridge = 1.0 - smoothstep(0.0, 0.12, v.w - v.x);
  float sweep = sin(v.x * 9.0 + v.z * 6.28) * (0.3 + 0.7 * v.x);
  vec4 n = nT(p, vec2(0.8), vec2(0.0));
  vec4 g = nT(p, vec2(80.0), vec2(0.4, 0.1));
  vec4 ag = vT(p, vec2(0.011), vec2(0.37, 0.19));
  vec4 cv = vT(p, vec2(0.7), vec2(0.5, 0.5));
  float st = smoothstep(0.1, 0.8, nT(p, vec2(0.5), vec2(0.7, 0.2)).y) * uP1.x;
  float peb = uP0.w * step(0.5, ag.z) * (1.0 - smoothstep(0.2, 0.42, ag.x));
  float crack = uP0.z * (1.0 - smoothstep(0.0, 0.0025, cv.y)) * step(0.55, cv.z);
  s.h = n.x * 0.0015 + ridge * uP0.x + sweep * uP0.x * 0.25 + g.x * uP0.y + peb * 0.0012 - crack * 0.0008;
  vec3 col = mix(uC0, uC1, st);
  col *= 1.0 + 0.04 * n.y + 0.03 * g.x;
  col = mix(col, uC2 * (0.8 + 0.4 * ag.z), peb);
  col *= 1.0 - 0.35 * crack;
  s.alb = col;
  s.rough = uP1.y + 0.05 * g.x + 0.04 * st - 0.04 * ridge;
  s.ao = 1.0 - 0.3 * crack;
}`,
  },

  // The altar's skin: whole rounded field-stones (avanim shlemot, mefulamot — "large and small") cast in a
  // lime/lead/pitch slurry, whitewashed with lime twice a year without an iron trowel (Middot 3:4; Zevachim
  // 54a; Rambam BhB 2:16). uP1.x = 1 paints the red ochre girdle (chut hasikra, Middot 3:1) on the same skin.
  // Walking surfaces (uP2.x, the kevesh, sovev and walkway): the stones are buried under renewed lime and worn flat,
  // but the lime keeps its character — cloth-wipe strokes, a darker, glossier lane of bare-foot traffic along v,
  // hairline crazing, patched repairs and worn, darkened arrises at the low spots.
  whitewash: {
    hRange: 0.04, ao: [0.08, 0.012, 0.55],
    src: /* glsl */`
// uP0: x big stone height, y small stone height, z lime level, w cloth-wipe stroke amp
// uP1: x paint (0 whitewash, 1 ochre), y rough, z outline warp (m), w stone tone through thin lime
// uP2: x foot wear (walking surfaces), y soot, z blood stain, w stain wash-out (0 fresh .. 1 almost gone)
// uP3: x traffic-lane period across v (m; 0 = none), y crazing, z patches
// uC0 lime white, uC1 grime, uC2 paint colour, uC3 soot, uC4 dried blood
float cap(float d) { float t = smoothstep(1.0, 0.0, d); return t * (2.0 - t); }   // soft pillow, zero slope at its foot
void surf(vec2 p, inout S s) {
  // domain-warped Voronoi: irregular, rounded stone outlines instead of straight cell polygons
  vec4 wp = nT(p, vec2(3.0), vec2(0.43, 0.27));
  vec4 v1 = vT(p + wp.xy * uP1.z, vec2(0.30), vec2(0.0));
  vec4 v2 = vT(p + wp.zw * uP1.z * 0.6, vec2(0.11), vec2(0.31, 0.77));
  vec4 n = nT(p, vec2(2.0), vec2(0.0));
  float wipe = nT(p, vec2(1.2, 26.0), vec2(0.2, 0.6)).y;      // horizontal cloth strokes (no iron trowel)
  float wgate = smoothstep(-0.1, 0.5, nT(p, vec2(3.0, 1.0), vec2(0.66, 0.12)).x);
  vec4 g = nT(p, vec2(70.0), vec2(0.5, 0.5));
  float drip = smoothstep(0.1, 0.9, nT(p, vec2(6.0, 0.6), vec2(0.7, 0.1)).y);
  vec4 sootN = nT(p, vec2(1.5, 0.4), vec2(0.27, 0.81));      // soot: patchy, streaked upward (smoke rises)
  vec4 sootF = nT(p, vec2(9.0, 2.0), vec2(0.52, 0.36));
  vec4 runN = nT(p, vec2(5.0, 0.5), vec2(0.13, 0.47));       // runs: narrow, long, downward
  vec4 patchN = nT(p, vec2(1.0), vec2(0.88, 0.22));
  vec4 scuff = nT(p, vec2(2.5, 6.0), vec2(0.4, 0.9));        // foot scuffs, polish patches
  vec4 lane = nT(p, vec2(0.6, 1.2), vec2(0.17, 0.39));       // wander and strength of the traffic bands
  vec4 cz = vT(p + wp.xy * 0.02, vec2(0.09), vec2(0.53, 0.21));   // crazing of the lime skin
  vec4 pv = vT(p + wp.zw * 0.05, vec2(0.55), vec2(0.77, 0.61));   // patched repairs
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  // whole rounded field-stones, large and small, closely packed: low pillows (a round dome) softly limited
  // toward the (warped) cell border by F2-F1, whose iso-lines round the polygon corners, over a wide ramp
  float d1 = cap(v1.x / (0.5 + 0.1 * v1.z)) * smoothstep(0.0, 0.32, v1.w - v1.x) * (0.65 + 0.45 * fract(v1.z * 7.31));
  float d2 = cap(v2.x / (0.45 + 0.08 * n.z)) * smoothstep(0.0, 0.32, v2.w - v2.x) * (0.7 + 0.3 * fract(v2.z * 5.17));
  // feet wear the relief down: the stones' crowns are flattened into the lime
  float stones = smax(d1 * uP0.x, d2 * uP0.y, 0.004) * (1.0 - 0.85 * uP2.x);
  // thick, renewed lime buries the stones' feet in broad soft fillets
  float h = smax(stones, uP0.z + n.x * 0.0015, 0.008);
  float ws = wipe * wgate;
  h += ws * uP0.w + g.x * 0.0003;
  // walking surfaces: a bare-foot lane every uP3.x across v (wandering), worn a little hollow, darker and glossier;
  // hairline crazing (>= 2 texels wide); a few patches of newer lime, slightly proud and whiter, their edges feathered
  float lx = uP3.x > 0.0 ? abs(fract(p.x / max(uP3.x, 1e-3) + 0.1 * lane.x) - 0.5) * 2.0 : 1.0;
  float traffic = uP2.x * (1.0 - smoothstep(0.1, 0.55, lx + 0.15 * scuff.y)) * smoothstep(-0.5, 0.4, lane.y + 0.5 * scuff.z) * step(0.001, uP3.x);
  float crW = max(0.0012, tex * 1.1);
  float craze = uP3.y * (1.0 - smoothstep(0.0, crW / 0.09, cz.y)) * smoothstep(0.25, 0.7, patchN.w + 0.3 * n.y) * 0.6;
  float patchM = uP3.z * step(0.82, pv.z) * (1.0 - smoothstep(0.32, 0.42, pv.x + 0.04 * wp.x));
  h += -traffic * 0.0015 - craze * 0.0004 + patchM * 0.0012;
  s.h = h;
  float low = 1.0 - smoothstep(0.0, uP0.z * 1.4, h);
  float crown = smoothstep(uP0.z, uP0.z + 0.004, stones);
  vec3 col = uC0 * (1.0 + 0.02 * ws + 0.012 * g.x + 0.012 * n.y);
  col = mix(col, col * vec3(0.975, 0.96, 0.935), crown * uP1.w);
  col = mix(col, uC1, low * 0.15 + drip * 0.06);
  vec3 paint = uC2 * (1.0 + 0.08 * wipe + 0.04 * g.x + 0.05 * n.z) * (1.0 - 0.1 * low);
  col = mix(col, paint, uP1.x * (0.94 + 0.06 * smoothstep(-0.4, 0.4, wipe)));
  // walking surfaces: bare feet polish the lime in broad patches, grime keeps to the low spots and joints
  float pol = uP2.x * smoothstep(-0.3, 0.6, scuff.x + 0.4 * patchN.y);
  col = mix(col, col * vec3(0.94, 0.925, 0.9), uP2.x * (0.25 * low + 0.12 * smoothstep(0.2, 0.8, scuff.w)));
  col = mix(col, col * vec3(0.86, 0.845, 0.82), traffic * (0.6 + 0.4 * smoothstep(-0.3, 0.5, scuff.w)));
  col = mix(col, col * vec3(0.9, 0.89, 0.87), uP2.x * 0.8 * smoothstep(0.0, 0.6, ws));       // wipe streaks show on the worn lime
  col *= 1.0 + uP2.x * (0.05 * patchN.z + 0.035 * n.y);                                       // a soft mottle of wear and dust
  // the buried stones' outlines ghost through as a faint line of grime where the lime is thinnest over the joints
  float ghost = uP2.x * (1.0 - smoothstep(0.0, 0.06, v1.w - v1.x)) * (0.5 + 0.5 * smoothstep(-0.2, 0.5, patchN.z));
  col *= 1.0 - 0.09 * ghost;
  col *= 1.0 - 0.16 * craze;
  col = mix(col, uC0 * 1.02, patchM * 0.8);
  // soot from the pyre's smoke: grey-brown, patchy, in faint upward streaks, heavier toward the top edge of a face
  float soot = uP2.y * clamp(smoothstep(-0.35, 0.55, sootN.x + 0.35 * sootF.y) * (0.55 + 0.45 * smoothstep(-0.2, 0.6, sootF.x)), 0.0, 1.0);
  col = mix(col, uC3 * (0.85 + 0.3 * g.x), soot * 0.55);
  // blood (the shirayim and the lower bloods): mostly washed out — faint brown-red runs and a few patches
  float run = smoothstep(0.55, 0.9, 1.0 - abs(runN.y)) * smoothstep(-0.2, 0.5, runN.z);
  float stain = uP2.z * clamp(run * 0.8 + smoothstep(0.35, 0.8, patchN.x) * 0.45, 0.0, 1.0) * (1.0 - uP2.w * 0.7);
  col = mix(col, uC4 * (0.9 + 0.2 * g.y), stain * 0.42);
  s.alb = col;
  s.rough = uP1.y + 0.04 * g.x - 0.03 * crown - 0.18 * pol - 0.14 * traffic + 0.06 * soot - 0.04 * stain + 0.06 * patchM + 0.05 * craze;
  s.ao = 1.0 - 0.25 * craze;
}`,
  },

  // Natural Jerusalem limestone: the bare Even Shetiyah (Yoma 5:2) and the outcrops around the Mount.
  rock: {
    hRange: 0.16, ao: [0.12, 0.03, 0.55],
    src: /* glsl */`
// uP0: x relief (m), y crevices, z pits, w karren runnels;  uP1: x patina/lichen, y soil in crevices, z rough
// uC0 base, uC1 alternate, uC2 patina, uC3 soil
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(0.5), vec2(0.0));
  vec2 q = p + wp.xy * 0.3;
  vec4 big = nT(q, vec2(0.3), vec2(0.4, 0.1));
  vec4 mid = nT(q, vec2(2.0), vec2(0.5, 0.2));
  vec4 sm = nT(q, vec2(8.0), vec2(0.15, 0.65));
  vec4 fine = nT(p, vec2(34.0), vec2(0.9, 0.1));
  vec4 cv = vT(q + wp.zw * 0.25, vec2(1.3), vec2(0.0));
  float kn = nT(p, vec2(4.0, 0.5), vec2(0.6, 0.4)).x;
  float bed = nT(p, vec2(0.2, 2.5), vec2(0.27, 0.58)).z;
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float rm = 1.0 - abs(mid.y);
  float rs = 1.0 - abs(sm.w);
  // crevices: only some cell borders open up (gated along their length — softly, so a crevice tapers out instead of
  // breaking into a chain of dots), widths vary but never under ~3 texels (in cell units of 1.3 m)
  float cgate = smoothstep(0.0, 0.6, mid.w + 0.3 * big.z);
  float cw = max(0.03 + 0.02 * sm.x, tex * 3.0 / 1.3) * (0.5 + 0.5 * cgate);
  float crev = uP0.y * cgate * (1.0 - smoothstep(0.0, cw, cv.y));
  // dissolution pits: irregular, clustered on exposed highs
  float pit = uP0.z * smoothstep(0.5, 0.8, -sm.x + 0.3 * fine.w) * smoothstep(-0.1, 0.4, big.y);
  float kar = uP0.w * smoothstep(0.2, 0.8, abs(kn)) * smoothstep(0.0, 0.5, big.x);
  s.h = big.x * uP0.x + rm * rm * uP0.x * 0.4 + rs * 0.008 + sm.y * 0.004 + fine.w * 0.0018 + fine.x * 0.0008
      - crev * 0.04 - pit * 0.008 - kar * 0.012;
  vec3 col = mix(uC0, uC1, smoothstep(-0.3, 0.5, big.y + 0.4 * bed));
  col *= 1.0 + 0.08 * mid.x + 0.06 * sm.y + 0.05 * fine.x - 0.05 * (1.0 - rs);
  float hollow = smoothstep(0.0, 0.6, -mid.x);
  float pat = uP1.x * clamp(smoothstep(0.0, 0.6, nT(p, vec2(1.4), vec2(0.2, 0.9)).w) * 0.6 + hollow * 0.5, 0.0, 1.0);
  col = mix(col, uC2, pat * 0.7);
  float lich = uP1.x * smoothstep(0.6, 0.85, sm.z + 0.5 * fine.y) * smoothstep(0.0, 0.4, big.x);
  col = mix(col, uC2 * vec3(0.82, 0.86, 0.82), lich * 0.45);
  float soilm = uP1.y * max(crev, pit * 0.8);
  col = mix(col, uC3, soilm);
  s.alb = col;
  s.rough = uP1.z - 0.05 * rm + 0.05 * soilm;
  s.ao = 1.0 - 0.35 * crev - 0.2 * pit;
}`,
  },

  // Terra rossa between the rocks: red-brown clods, limestone pebbles, dry cracks.
  soil: {
    hRange: 0.04, ao: [0.03, 0.006, 0.5],
    src: /* glsl */`
// uP0: x clod relief, y pebble density, z cracks, w pebble size (m)
// uP1: x rolled (a roof of earth rolled flat: relief smoothed, roller bands), y straw flecks, z lime patches,
//      w ground relief (m)
// uC0 soil, uC1 darker, uC2 pebble, uC3 dust, uC4 lime / straw
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(1.5), vec2(0.0));
  vec2 q = p + wp.xy * 0.03;
  vec4 cl = vT(q, vec2(0.05), vec2(0.0));
  vec4 pv = vT(q + wp.zw * 0.02, vec2(uP0.w * 2.5), vec2(0.71, 0.29));
  vec4 cv = vT(q, vec2(0.3), vec2(0.4, 0.8));
  vec4 n = nT(p, vec2(0.6), vec2(0.0));
  vec4 g = nT(p, vec2(60.0), vec2(0.3, 0.5));
  vec4 mo = nT(p, vec2(0.35), vec2(0.6, 0.1));
  float roll = nT(p, vec2(0.25, 2.2), vec2(0.17, 0.83)).z;          // roller passes: soft bands along u
  float straw = nT(p, vec2(9.0, 90.0), vec2(0.44, 0.12)).y;          // chopped straw in the mud: short streaks
  float strawG = nT(p, vec2(14.0), vec2(0.61, 0.73)).x;
  float clod = sqrt(clamp(1.0 - cl.x / (0.6 + 0.3 * cl.z), 0.0, 1.0)) * (1.0 - 0.85 * uP1.x);
  float pr = 0.12 + 0.3 * fract(pv.z * 5.13);
  float isP = step(1.0 - uP0.y, fract(pv.z * 11.7)) * smoothstep(-0.2, 0.3, mo.w);
  float peb = isP * sqrt(clamp(1.0 - pow((pv.x + 0.08 * wp.w) / pr, 2.0), 0.0, 1.0));
  float texel = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float crack = uP0.z * (1.0 - smoothstep(0.0, max(0.01, 0.9 * texel / 0.3), cv.y)) * smoothstep(0.0, 0.5, -mo.y) * step(0.35, cv.z);
  s.h = n.x * uP1.w + clod * uP0.x + peb * uP0.w * 0.45 * (1.0 - 0.6 * uP1.x) - crack * 0.004 + g.x * 0.0008 + roll * 0.002 * uP1.x;
  vec3 col = mix(uC0, uC1, smoothstep(-0.3, 0.6, mo.y));
  col = mix(col, uC3, smoothstep(0.4, 1.0, clod) * 0.3 + smoothstep(0.2, 0.7, mo.x) * 0.2);
  col *= 1.0 + 0.08 * g.y + 0.05 * wp.z + 0.05 * roll * uP1.x;
  vec3 pc = uC2 * (0.7 + 0.35 * fract(pv.z * 3.7)) * (1.0 + 0.1 * g.x);
  col = mix(col, pc, smoothstep(0.0, 0.35, peb) * 0.85);
  // a rolled roof: lime worked into the top in patches, straw flecks
  float lime = uP1.z * smoothstep(0.25, 0.75, n.z + 0.3 * mo.z);
  col = mix(col, uC4, lime * 0.45);
  float fleck = uP1.y * smoothstep(0.55, 0.85, straw) * smoothstep(0.2, 0.6, strawG);
  col = mix(col, uC4 * vec3(1.0, 0.92, 0.72), fleck * 0.5);
  col *= 1.0 - 0.35 * crack;
  s.alb = col;
  s.rough = 0.95 - 0.1 * smoothstep(0.0, 0.3, peb) - 0.05 * uP1.x * (0.5 + 0.5 * roll);
  s.ao = 1.0 - 0.3 * crack;
}`,
  },

  // Wood ash (the tapuach and Beit HaDeshen): powdery grey with charcoal fragments.
  ash: {
    hRange: 0.03, ao: [0.02, 0.008, 0.25],
    src: /* glsl */`
// uP0: x lump relief, y charcoal density, z brown char share, w tile-scale tone drift
// uC0 ash light, uC1 ash dark, uC2 charcoal, uC3 brown char
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(3.0), vec2(0.0));
  vec2 q = p + wp.xy * 0.025;
  vec4 n = nT(p, vec2(0.7), vec2(0.2, 0.6));
  vec4 L = nT(p, vec2(0.5), vec2(0.45, 0.15));      // drifts of lighter / darker, warmer / cooler ash across the tile
  vec4 l = nT(p, vec2(4.0), vec2(0.3, 0.6));
  vec4 l2 = nT(p, vec2(14.0), vec2(0.7, 0.2));
  vec4 cv = vT(q, vec2(0.06), vec2(0.0));
  vec4 cv2 = vT(q + 0.37, vec2(0.02), vec2(0.5, 0.2));
  vec4 g = nT(p, vec2(90.0), vec2(0.5, 0.2));
  float mo = nT(p, vec2(1.2), vec2(0.8, 0.4)).y;
  float big = step(1.0 - uP0.y, cv.z) * (1.0 - smoothstep(0.22, 0.32, cv.x + 0.22 * l2.w + 0.1 * fract(cv.z * 13.1)));
  float small = step(1.0 - uP0.y * 1.6, cv2.z) * (1.0 - smoothstep(0.14, 0.24, cv2.x + 0.2 * wp.w));
  // charcoal mostly buried in the powdery ash, and dusted over where it shows (materials-2: fewer, shallower dark bits)
  float buried = smoothstep(-0.1, 0.5, l.z + 0.4 * n.z);
  float dust = smoothstep(-0.2, 0.6, l2.z);
  float ch = max(big, small * 0.45) * buried;
  s.h = n.x * 0.01 + l.x * uP0.x + l2.x * uP0.x * 0.3 + ch * 0.002 + g.x * 0.0004;
  vec3 col = mix(uC0, uC1, smoothstep(-0.4, 0.5, mo + 0.3 * l.y));
  col *= 1.0 + uP0.w * L.x + 0.04 * g.y + 0.04 * l2.y;
  col = mix(col, col * vec3(1.03, 1.0, 0.95), smoothstep(0.0, 0.6, L.z) * 0.5);
  float br = uP0.z * step(0.6, fract(cv.z * 9.7));
  vec3 cc = mix(uC2, uC3, br) * (0.75 + 0.5 * g.x);
  col = mix(col, mix(cc, uC1, 0.35 * dust), ch * (1.0 - 0.4 * dust));
  s.alb = col;
  s.rough = 0.98 - 0.1 * ch;
}`,
  },

  // Field-stone rubble walls of the city houses: roughly coursed limestone field stones (15-45 cm, flatter than
  // tall) in a mud-lime mortar, joints wide and raked back, small chinking stones; weathered grey faces, lichen.
  // materials-2-fix: the stones are rounded 3D pillows standing well proud of a mortar that is set back and shaded
  // (relief + cavity AO carry the read, not an albedo contrast — pale blobs in dark mortar read as a cow print);
  // stone and mortar close in value; courses suggested by flattened cells.
  rubble: {
    hRange: 0.1, ao: [0.05, 0.025, 0.65],
    src: /* glsl */`
// uP0: x stone cell u (m), y stone cell v (m), z mortar joint (m), w stone relief (m)
// uP1: x lichen, y mortar recess (m), z chinking stones
// uC0 stone grey, uC1 stone buff, uC2 mortar, uC3 lichen, uC4 stone dark
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(1.2), vec2(0.0));
  vec4 wq = nT(p, vec2(7.0), vec2(0.41, 0.77));
  vec2 q = p + wp.xy * 0.05 + wq.xy * 0.012;
  vec4 v = vT(q, uP0.xy, vec2(0.0));
  vec4 vs = vT(q + 0.29, uP0.xy * 0.4, vec2(0.53, 0.17));
  vec4 n = nT(p, vec2(5.0), vec2(0.3, 0.6));
  vec4 f = nT(p, vec2(35.0), vec2(0.7, 0.1));
  vec4 lc = nT(p, vec2(3.0), vec2(0.85, 0.35));
  vec4 g = nT(p, vec2(120.0), vec2(0.15, 0.55));
  vec4 fp = nT(p, vec2(12.0), vec2(0.23, 0.31));     // fracture planes of the split faces
  float cs = min(uP0.x, uP0.y);
  // F2 - F1 rounds the cell corners: field stones, not cut polygons
  float bd = 0.6 * (v.w - v.x) * cs;
  float jw = uP0.z * (0.5 + 0.8 * fract(v.z * 3.3)) * 0.5;
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float edgeW = max(0.012, tex * 1.5);
  float stone = smoothstep(jw, jw + edgeW, bd + 0.008 * n.x + 0.005 * wq.z);
  // a rounded pillow over the whole stone (strong curvature toward its edge) with a flattish, split face on top
  float u = clamp(bd / (0.45 * cs), 0.0, 1.0);
  float pillow = sqrt(u * (2.0 - u));
  float facet = 0.012 * fp.x + 0.006 * wq.w;
  float ht = uP0.w * (0.65 + 0.35 * fract(v.z * 5.7));
  float ck = uP1.z * step(0.55, vs.z) * (1.0 - smoothstep(0.25, 0.38, vs.x)) * (1.0 - stone);
  float ckH = sqrt(clamp(1.0 - pow(vs.x / 0.38, 2.0), 0.0, 1.0));
  float mortar = -uP1.y + f.y * 0.003 + n.y * 0.004 + g.x * 0.0008;
  float h = mix(mortar, -uP1.y * 0.3 + pillow * ht + facet * pillow + f.x * 0.002 + g.x * 0.0006, stone);
  h = max(h, ck * (-uP1.y * 0.4 + ckH * uP0.w * 0.45 + f.x * 0.002));
  s.h = h;
  float t = fract(v.z * 9.13);
  vec3 sc = mix(uC0, uC1, smoothstep(0.3, 0.8, t)) * (0.92 + 0.12 * fract(v.z * 4.7));
  sc = mix(sc, uC4, smoothstep(0.88, 1.0, t) * 0.45);
  sc *= 1.0 + 0.07 * n.z + 0.06 * f.z + 0.05 * g.x;
  float lich = uP1.x * smoothstep(0.45, 0.8, lc.x + 0.3 * f.w) * pillow;
  sc = mix(sc, uC3 * (0.8 + 0.4 * g.y), lich * 0.55);
  vec3 mc = uC2 * (0.9 + 0.12 * f.y + 0.08 * g.z);
  float st = max(stone, ck);
  s.alb = mix(mc, sc, st);
  s.rough = mix(0.95, 0.86 - 0.04 * pillow, st);
  s.ao = mix(0.7, 1.0, st) * (0.88 + 0.12 * smoothstep(0.0, 0.5, u + 1.0 - stone));
}`,
  },
};

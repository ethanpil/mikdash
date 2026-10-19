// Generator "kinds": one loop-free GLSL surface function each (`void surf(vec2 p, inout S s)`, p in meters
// inside the tile), built from basis-map lookups (nT/nL noise, vT/vL Voronoi — see glsl.js). A texture SET
// (sets.js) = kind + tile size + resolution + parameter uniforms (+ masonry layout).
// Research grounding per kind is noted inline; reconstruction choices are logged in docs/decisions/materials.md.
// Texture fetches stay outside data-dependent branches (implicit derivatives).

const shapes = /* glsl */`
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdEllipse(vec2 p, vec2 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float fill(float d, float w) { return 1.0 - smoothstep(-w, 0.0, d); }
`;

export const KINDS = {
  // Herodian marble ashlar: courses of white (shayish), blue-green (kochla) and veined (marmara) marble,
  // one course set out and one drawn in (apik shefa v'a'eil shefa — Bava Batra 4a), left unplastered.
  // Drafted margins with a finely dressed, slightly raised boss (uP1.x = 1) or plain fine-dressed faces
  // (uP1.x = 0, the inner-face variant). Row code = colour type * 2 + set-out flag.
  herodian: {
    hRange: 0.09, ao: [0.04, 0.03, 0.35],
    src: /* glsl */`
// uP0: x margin width (m), y boss raise (m), z joint half-width (m), w course set-out (m)
// uP1: x drafted-margin boss on/off, y tooling amp (m), z soiling, w vein scale
// uP2: x joint depth (m), y arris rounding (m), z set-out shadow band (m), w its darkening
// uC0..2 course colours (shayish, kochla, marmara), uC3..5 their veins/streaks, uC6 kochla band colour
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  float outF = mod(b.code, 2.0);
  int ct = int(floor(b.code * 0.5 + 0.01));
  vec3 bh = blkHash(b, 101);
  float ex = min(b.lx, b.len - b.lx);
  float ey = min(b.ly, uRowH - b.ly);
  vec2 lp = vec2(b.lx, b.ly) + bh.xy * 37.0;
  vec4 nA = nL(lp, vec2(9.0), vec2(0.0));
  vec4 nB = nL(lp, vec2(1.3), vec2(0.31, 0.17));
  vec4 nC = nL(lp, vec2(38.0), vec2(0.73, 0.41));
  // comb-chisel strokes on the drafted margin run perpendicular to the edge they dress (mitred at corners);
  // the boss is finely pecked with a point
  float comb = smoothstep(-0.25, 0.25, nL(ex < ey ? lp.yx : lp, vec2(60.0, 2.0), vec2(0.19, 0.61)).y) * 2.0 - 1.0;
  vec4 pk = vL(lp, vec2(0.012), vec2(0.23, 0.57));
  float peck = step(0.55, pk.z) * (1.0 - smoothstep(0.15, 0.4, pk.x));
  // dry hairline joints: arrises rounded a few mm, chipped here and there (more at block corners)
  float corner = 1.0 - smoothstep(0.0, 0.15, max(ex, ey));
  float chip = 0.004 * smoothstep(0.6, 0.9, nA.z) + 0.006 * corner * smoothstep(0.35, 0.8, nA.w);
  float e = min(ex, ey) + 0.001 * nA.x - chip;
  float face = smoothstep(uP0.z - 0.0005, uP0.z + 0.0005, e);
  float tA = clamp((e - uP0.z) / uP2.y, 0.0, 1.0);
  float arris = sqrt(tA * (2.0 - tA));
  // drafted margin: a flat band ~8-14 cm, then a crisp hand-cut step up to the finely dressed boss
  float mw = uP0.x * (0.8 + 0.4 * bh.z) + 0.006 * nB.w;
  float boss = uP1.x * smoothstep(mw - 0.0025, mw + 0.0025, e + 0.003 * nA.y);
  float fine = max(boss, 1.0 - uP1.x);
  float marg = uP1.x * (1.0 - boss);
  float plane = outF * uP0.w;
  float hFace = plane + boss * (uP0.y * (0.7 + 0.6 * bh.x) + 0.002 * nB.z) + nB.x * 0.002 * (0.5 + fine)
              + marg * comb * uP1.y + fine * (nC.w * uP1.y * 0.4 - peck * 0.0003);
  s.h = mix(plane - uP2.x, hFace, arris * face);
  vec3 base = ct == 0 ? uC0 : (ct == 1 ? uC1 : uC2);
  vec3 vein = ct == 0 ? uC3 : (ct == 1 ? uC4 : uC5);
  float tint = 0.95 + 0.1 * bh.x;
  float vm;
  vec3 col = marble(lp * uP1.w, true, ct, base * tint, vein, uC6 * tint, vm);
  // tooled margin lighter (fresh comb-chiselled surface scatters more); pecked boss stippled a little darker;
  // worn arris catches light; the hairline joint itself only mildly dark
  col *= 1.0 + marg * (0.07 + 0.035 * comb) - fine * uP1.x * 0.05 * peck;
  col *= 1.0 + 0.05 * (1.0 - arris) * face;
  col = mix(col * 0.85, col, face);
  float soil = uP1.z * (1.0 - smoothstep(0.0, 0.4, b.ly)) * (0.6 + 0.4 * nB.y);
  col *= 1.0 - 0.08 * soil;
  // weathering: faint rain-wash streaks running down from each course top
  vec4 sw = nT(p, vec2(9.0, 0.35), vec2(0.37, 0.13));
  float streak = smoothstep(0.15, 0.6, sw.x) * smoothstep(0.0, 0.7, (uRowH - b.ly) / uRowH) * uP1.z;
  col *= 1.0 - 0.06 * streak;
  col *= 1.0 + 0.02 * nC.y;
  // apik shefa v'a'eil shefa: the set-out course above overhangs each drawn-in course — its soffit and shadow
  // darken a band along the drawn-in course's top, so the alternation still reads where the 4 cm is not modelled
  float band = (1.0 - outF) * (1.0 - smoothstep(0.0, uP2.z, uRowH - b.ly + 0.008 * nB.y));
  col *= 1.0 - uP2.w * band;
  s.alb = col;
  s.rough = mix(0.82, mix(0.68, 0.58, fine) + 0.08 * marg + (ct == 1 ? 0.04 : 0.0) + 0.04 * nC.w - 0.05 * vm
                + 0.06 * soil + 0.04 * streak, face);
  s.ao = mix(0.85, 1.0, face) * (1.0 - 0.45 * band);
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
  float e = min(ex, ey) + uP0.x * 0.8 * nA.x;
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
  col = mix(mix(mix(uC3, lime * 0.95, wash * uP1.z), lime, bridge), col, face);
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
  whitewash: {
    hRange: 0.04, ao: [0.08, 0.012, 0.55],
    src: /* glsl */`
// uP0: x big stone height, y small stone height, z lime level, w cloth-wipe stroke amp
// uP1: x paint (0 whitewash, 1 ochre), y rough, z outline warp (m), w stone tone through thin lime
// uC0 lime white, uC1 grime, uC2 paint colour
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
  // whole rounded field-stones, large and small, closely packed: low pillows (a round dome) softly limited
  // toward the (warped) cell border by F2-F1, whose iso-lines round the polygon corners, over a wide ramp
  float d1 = cap(v1.x / (0.5 + 0.1 * v1.z)) * smoothstep(0.0, 0.32, v1.w - v1.x) * (0.65 + 0.45 * fract(v1.z * 7.31));
  float d2 = cap(v2.x / (0.45 + 0.08 * n.z)) * smoothstep(0.0, 0.32, v2.w - v2.x) * (0.7 + 0.3 * fract(v2.z * 5.17));
  float stones = smax(d1 * uP0.x, d2 * uP0.y, 0.004);
  // thick, renewed lime buries the stones' feet in broad soft fillets
  float h = smax(stones, uP0.z + n.x * 0.0015, 0.008);
  float ws = wipe * wgate;
  h += ws * uP0.w + g.x * 0.0003;
  s.h = h;
  float low = 1.0 - smoothstep(0.0, uP0.z * 1.4, h);
  float crown = smoothstep(uP0.z, uP0.z + 0.004, stones);
  vec3 col = uC0 * (1.0 + 0.02 * ws + 0.012 * g.x + 0.012 * n.y);
  col = mix(col, col * vec3(0.975, 0.96, 0.935), crown * uP1.w);
  col = mix(col, uC1, low * 0.15 + drip * 0.06);
  vec3 paint = uC2 * (1.0 + 0.08 * wipe + 0.04 * g.x + 0.05 * n.z) * (1.0 - 0.1 * low);
  col = mix(col, paint, uP1.x * (0.94 + 0.06 * smoothstep(-0.4, 0.4, wipe)));
  s.alb = col;
  s.rough = uP1.y + 0.04 * g.x - 0.03 * crown;
}`,
  },

  // Natural Jerusalem limestone: the bare Even Shetiyah (Yoma 5:2) and the outcrops around the Mount.
  rock: {
    hRange: 0.16, ao: [0.12, 0.03, 0.6],
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
  float rm = 1.0 - abs(mid.y);
  float rs = 1.0 - abs(sm.w);
  // crevices: only some cell borders open up (gated along their length), widths vary
  float cgate = smoothstep(0.15, 0.45, mid.w + 0.3 * big.z);
  float crev = uP0.y * cgate * (1.0 - smoothstep(0.0, 0.035 + 0.025 * sm.x, cv.y));
  // dissolution pits: irregular, clustered on exposed highs
  float pit = uP0.z * smoothstep(0.5, 0.8, -sm.x + 0.3 * fine.w) * smoothstep(-0.1, 0.4, big.y);
  float kar = uP0.w * smoothstep(0.2, 0.8, abs(kn)) * smoothstep(0.0, 0.5, big.x);
  s.h = big.x * uP0.x + rm * rm * uP0.x * 0.4 + rs * 0.008 + sm.y * 0.004 + fine.w * 0.0018 + fine.x * 0.0008
      - crev * 0.05 - pit * 0.008 - kar * 0.012;
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
  s.ao = 1.0 - 0.45 * crev - 0.2 * pit;
}`,
  },

  // Terra rossa between the rocks: red-brown clods, limestone pebbles, dry cracks.
  soil: {
    hRange: 0.04, ao: [0.03, 0.006, 0.5],
    src: /* glsl */`
// uP0: x clod relief, y pebble density, z cracks, w pebble size (m);  uC0 soil, uC1 darker, uC2 pebble, uC3 dust
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(1.5), vec2(0.0));
  vec2 q = p + wp.xy * 0.03;
  vec4 cl = vT(q, vec2(0.05), vec2(0.0));
  vec4 pv = vT(q + wp.zw * 0.02, vec2(uP0.w * 2.5), vec2(0.71, 0.29));
  vec4 cv = vT(q, vec2(0.3), vec2(0.4, 0.8));
  vec4 n = nT(p, vec2(0.6), vec2(0.0));
  vec4 g = nT(p, vec2(60.0), vec2(0.3, 0.5));
  vec4 mo = nT(p, vec2(0.35), vec2(0.6, 0.1));
  float clod = sqrt(clamp(1.0 - cl.x / (0.6 + 0.3 * cl.z), 0.0, 1.0));
  float pr = 0.12 + 0.3 * fract(pv.z * 5.13);
  float isP = step(1.0 - uP0.y, fract(pv.z * 11.7)) * smoothstep(-0.2, 0.3, mo.w);
  float peb = isP * sqrt(clamp(1.0 - pow((pv.x + 0.08 * wp.w) / pr, 2.0), 0.0, 1.0));
  float crack = uP0.z * (1.0 - smoothstep(0.0, 0.01, cv.y)) * smoothstep(0.0, 0.5, -mo.y);
  s.h = n.x * 0.012 + clod * uP0.x + peb * uP0.w * 0.45 - crack * 0.004 + g.x * 0.0008;
  vec3 col = mix(uC0, uC1, smoothstep(-0.3, 0.6, mo.y));
  col = mix(col, uC3, smoothstep(0.4, 1.0, clod) * 0.3 + smoothstep(0.2, 0.7, mo.x) * 0.2);
  col *= 1.0 + 0.08 * g.y + 0.05 * wp.z;
  vec3 pc = uC2 * (0.7 + 0.35 * fract(pv.z * 3.7)) * (1.0 + 0.1 * g.x);
  col = mix(col, pc, smoothstep(0.0, 0.35, peb) * 0.85);
  col *= 1.0 - 0.35 * crack;
  s.alb = col;
  s.rough = 0.95 - 0.1 * smoothstep(0.0, 0.3, peb);
  s.ao = 1.0 - 0.3 * crack;
}`,
  },

  // Wood ash (the tapuach and Beit HaDeshen): powdery grey with charcoal fragments.
  ash: {
    hRange: 0.03, ao: [0.03, 0.005, 0.5],
    src: /* glsl */`
// uP0: x lump relief, y charcoal density, z brown char share;  uC0 ash light, uC1 ash dark, uC2 charcoal, uC3 brown char
void surf(vec2 p, inout S s) {
  vec4 wp = nT(p, vec2(3.0), vec2(0.0));
  vec2 q = p + wp.xy * 0.025;
  vec4 n = nT(p, vec2(0.7), vec2(0.2, 0.6));
  vec4 l = nT(p, vec2(4.0), vec2(0.3, 0.6));
  vec4 l2 = nT(p, vec2(14.0), vec2(0.7, 0.2));
  vec4 cv = vT(q, vec2(0.06), vec2(0.0));
  vec4 cv2 = vT(q + 0.37, vec2(0.02), vec2(0.5, 0.2));
  vec4 g = nT(p, vec2(90.0), vec2(0.5, 0.2));
  float mo = nT(p, vec2(1.2), vec2(0.8, 0.4)).y;
  float big = step(1.0 - uP0.y, cv.z) * (1.0 - smoothstep(0.22, 0.32, cv.x + 0.22 * l2.w + 0.1 * fract(cv.z * 13.1)));
  float small = step(1.0 - uP0.y * 1.6, cv2.z) * (1.0 - smoothstep(0.14, 0.24, cv2.x + 0.2 * wp.w));
  float buried = smoothstep(-0.3, 0.3, l.z + 0.4 * n.z);
  float ch = max(big, small * 0.7) * buried;
  s.h = n.x * 0.015 + l.x * uP0.x + l2.x * uP0.x * 0.35 + ch * 0.004 + g.x * 0.0004;
  vec3 col = mix(uC0, uC1, smoothstep(-0.4, 0.5, mo + 0.3 * l.y));
  col *= 1.0 + 0.05 * g.y + 0.05 * l2.y;
  float br = uP0.z * step(0.6, fract(cv.z * 9.7));
  col = mix(col, mix(uC2, uC3, br) * (0.75 + 0.5 * g.x), ch);
  s.alb = col;
  s.rough = 0.98 - 0.15 * ch;
}`,
  },

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

  // Gold fitted evenly over carved keruvim, palm trees and open flowers (keruvim d'tzurta, Yoma 54a; the
  // 1 Melachim 6:29 programme). Motif drawing, proportions and arrangement are reconstruction.
  relief: {
    hRange: 0.016, ao: [0.025, 0.004, 0.65],
    src: shapes + /* glsl */`
// uP0: x relief height (m), y band height (m), z module width (m), w seam gap (m)
// uP1: x rough on raised, y rough in recesses, z hammer dish depth
float rosette(vec2 q, float R) {
  float r = length(q);
  float a = atan(q.y, q.x);
  float pet = 0.5 + 0.5 * cos(a * 8.0);
  float edge = R * (0.6 + 0.4 * pow(pet, 0.4));
  float body = fill(r - edge, 0.012);
  float groove = (1.0 - smoothstep(0.0, 0.12, pet)) * smoothstep(R * 0.28, R * 0.42, r);
  float mid = exp(-pow((1.0 - pet) * 9.0, 2.0)) * smoothstep(R * 0.3, R * 0.5, r) * (1.0 - smoothstep(R * 0.75, R * 0.95, r));
  float centre = fill(r - R * 0.22, 0.015);
  float h = body * (0.45 + 0.35 * (1.0 - r / R)) - groove * body * 0.25 + mid * body * 0.08;
  return max(h, centre * (0.8 + 0.2 * sqrt(max(0.0, 1.0 - pow(r / (R * 0.22), 2.0)))));
}
// one palm frond at base angle ang (radians from vertical); v relative to the crown
float frond(vec2 v, float ang) {
  float L = 0.40 - 0.07 * abs(ang);
  float r = length(v);
  float t = clamp(r / L, 0.0, 1.0);
  float th = atan(v.x, v.y);
  float fa = ang + sign(ang) * 0.5 * t * t * smoothstep(0.1, 1.2, abs(ang));
  float d = max(abs(th - fa) * r - mix(0.024, 0.006, t), r - L);
  float leaf = 0.5 + 0.5 * sin(t * 26.0 * TAU);
  return fill(d, 0.006) * (0.42 + 0.2 * leaf * smoothstep(0.08, 0.3, t));
}
float palm(vec2 q, float H) {
  float top = H * 0.70;
  float tw = mix(0.05, 0.034, clamp(q.y / top, 0.0, 1.0));
  float dT = max(abs(q.x) - tw, max(0.07 - q.y, q.y - top));
  float trunk = fill(dT, 0.01);
  float bark = 0.5 + 0.5 * sin((q.y + abs(q.x) * 0.9) / 0.045 * TAU);
  float h = trunk * (0.6 + 0.15 * bark) * sqrt(max(0.0, 1.0 - pow(q.x / (tw + 0.01), 2.0)));
  vec2 v = q - vec2(0.0, top);
  float th = atan(v.x, v.y);
  float t = clamp(length(v) / 0.4, 0.0, 1.0);
  float thc = th - sign(th) * 0.4 * t * t;
  float i0 = clamp(floor((thc + 1.32) / 0.33 + 0.5), 0.0, 8.0);
  float f0 = frond(v, -1.32 + i0 * 0.33);
  float f1 = frond(v, -1.32 + max(i0 - 1.0, 0.0) * 0.33);
  float f2 = frond(v, -1.32 + min(i0 + 1.0, 8.0) * 0.33);
  h = max(h, max(f0, max(f1, f2)));
  return max(h, fill(length(v) - 0.05, 0.01) * 0.7);
}
float keruv(vec2 q, out float feather) {
  vec2 a = vec2(abs(q.x), q.y);
  float t = clamp((a.y - 0.10) / 1.02, 0.0, 1.0);
  float hw = mix(0.165, 0.10, t);
  float dRobe = max(a.x - hw, max(0.10 - a.y, a.y - 1.12));
  float dHead = length(a - vec2(0.0, 1.27)) - 0.085;
  float dNeck = sdBox(a - vec2(0.0, 1.16), vec2(0.035, 0.05));
  vec2 wl = rot2(a - vec2(0.10, 1.04), 0.55);
  float dWing = sdEllipse(wl - vec2(0.0, 0.31), vec2(0.12, 0.33));
  float dFeet = sdEllipse(a - vec2(0.065, 0.075), vec2(0.05, 0.028));
  float body = fill(min(min(dRobe, dNeck), dFeet), 0.012);
  float head = fill(dHead, 0.01);
  float wing = fill(dWing, 0.008);
  float folds = 0.5 + 0.5 * sin(a.x / 0.03 * TAU + a.y * 2.0);
  feather = wing * (0.5 + 0.5 * sin(wl.x / 0.024 * TAU));
  float cov = wing * smoothstep(0.42, 0.6, wl.y / 0.64);
  float scal = 0.5 + 0.5 * sin((wl.y + abs(sin(wl.x / 0.03 * PI)) * 0.012) / 0.03 * TAU);
  float hw2 = mix(0.42 + 0.1 * feather, 0.45 + 0.08 * scal, cov);
  float h = max(body * (0.62 + 0.12 * folds * smoothstep(0.2, 0.9, 1.0 - t)), wing * hw2);
  float hd = head * (0.75 + 0.25 * sqrt(max(0.0, 1.0 - pow(length(a - vec2(0.0, 1.27)) / 0.085, 2.0))));
  return max(h, hd);
}
void surf(vec2 p, inout S s) {
  vec4 dv = vT(p, vec2(0.022), vec2(0.0));
  float burn = nT(p, vec2(6.0, 30.0), vec2(0.3, 0.3)).y;
  float W = uP0.z;
  float bandH = uP0.y;
  float H = uTile.y;
  float fieldH = H - 2.0 * bandH;
  float fy = p.y - bandH;
  float feather = 0.0;
  float xp = p.x - floor(p.x / W + 0.5) * W;
  float xk = p.x - (floor(p.x / W) + 0.5) * W;
  float xr = p.x - (floor(p.x / (W * 0.25)) + 0.5) * W * 0.25;
  float yc = fy < 0.0 ? bandH * 0.5 : H - bandH * 0.5;
  float inField = step(0.0, fy) * step(fy, fieldH);
  float fig = max(palm(vec2(xp, fy), fieldH), keruv(vec2(xk, fy), feather));
  float ros = rosette(vec2(xr, p.y - yc), bandH * 0.36);
  float h = mix(ros, fig, inField);
  feather *= inField;
  float bd = min(abs(p.y - bandH), abs(p.y - (H - bandH)));
  float bead = sqrt(max(0.0, 1.0 - pow(bd / 0.014, 2.0)));
  h = max(h, bead * 0.55);
  float sx = abs(p.x - (floor(p.x / (W * 0.5)) + 0.5) * W * 0.5);
  float seamV = 1.0 - smoothstep(uP0.w * 0.5, uP0.w * 1.5, sx);
  float seamH = 1.0 - smoothstep(uP0.w * 0.5, uP0.w * 1.5, min(min(abs(bd - 0.02), p.y), H - p.y));
  float seam = max(seamV, seamH) * (1.0 - smoothstep(0.05, 0.2, h));
  float dish = uP1.z * (dv.x * dv.x - 0.3);
  s.h = h * uP0.x + dish - seam * 0.0006;
  float raised = smoothstep(0.05, 0.6, h);
  vec3 col = vec3(0.93 + 0.05 * raised + 0.012 * burn) * vec3(1.0, 0.988, 0.965);
  s.alb = mix(col, col * 0.45, seam);
  s.rough = mix(uP1.y, uP1.x, raised) + 0.03 * burn + 0.04 * feather * (1.0 - raised);
  s.rough = mix(s.rough, 0.6, seam);
  s.metal = mix(1.0, 0.5, seam);
}`,
  },

  // Cast / raised / hammered metal: vessels (gold of the grades, silver), Corinthian bronze, copper.
  metal: {
    hRange: 0.0012, ao: [0.01, 0.0002, 0.3],
    src: /* glsl */`
// uP0: x dish depth (m), y dish cell (m), z polish scratch amp (m), w rough base
// uP1: x tarnish, y tarnish rough, z verdigris, w rough variation
// uP2: x casting/planishing waviness (m), y its frequency (1/m), z polishing-streak rough amp, w patina in recesses
// uC0 clean tone, uC1 tarnish tone, uC2 verdigris albedo
void surf(vec2 p, inout S s) {
  vec4 dv = vT(p, vec2(uP0.y), vec2(0.0));
  float scr = nT(p, vec2(2.0, 160.0), vec2(0.3, 0.6)).y;
  vec4 n = nT(p, vec2(2.0), vec2(0.0));
  float tn = smoothstep(-0.2, 0.8, nT(p, vec2(1.2), vec2(0.5, 0.2)).z);
  float vgn = nT(p, vec2(3.0), vec2(0.8, 0.3)).y;
  vec4 wv = nT(p, vec2(uP2.y), vec2(0.6, 0.15));
  float strk = nT(p, vec2(1.5, 45.0), vec2(0.15, 0.8)).y;      // polishing streaks (along u)
  float wav = wv.x + 0.35 * wv.z;
  float rec = uP2.w * smoothstep(0.1, 0.9, -wav);                // low spots keep a faint darker patina
  s.h = uP0.x * (dv.x * dv.x - 0.3) * (0.6 + 0.8 * dv.z) + uP0.z * scr + n.x * 0.0005 + n.z * 0.0004 + uP2.x * wav;
  float tar = uP1.x * tn;
  vec3 col = mix(uC0 * (1.0 + 0.02 * scr), uC1, tar);
  col *= 1.0 - 0.08 * rec;
  float vg = uP1.z * smoothstep(0.35, 0.75, vgn);
  s.alb = mix(col, uC2, vg);
  s.metal = 1.0 - vg;
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

  // Wood: grain along u (uP3.w = 1 rotates the grain to run along v, for posts).
  wood: {
    hRange: 0.004, ao: [0.01, 0.0008, 0.5],
    src: /* glsl */`
// uP0: x rings per m (across grain), y ring warp, z pore amp, w knot density
// uP1: x rough, y weathering, z rays (oak), w figure (olive);  uC0 earlywood, uC1 latewood, uC2 figure / weathered
void surf(vec2 p0, inout S s) {
  bool rotd = uP3.w > 0.5;
  vec2 p = rotd ? p0.yx : p0;
  gT = rotd ? uTile.yx : uTile;
  vec4 w = nT(p, vec2(0.6, 4.0), vec2(0.0));
  vec4 kv = vT(p, vec2(0.6, 0.15), vec2(0.2, 0.7));
  float fib = nT(p, vec2(3.0, 500.0), vec2(0.4, 0.4)).y;
  float rayn = nT(p, vec2(30.0, 6.0), vec2(0.1, 0.9)).x;
  float fign = nT(p, vec2(1.0, 6.0), vec2(0.6, 0.2)).x;
  float chkn = nT(p, vec2(1.5, 30.0), vec2(0.8, 0.3)).y;
  float chkm = nT(p, vec2(1.0), vec2(0.3, 0.1)).z;
  vec4 lo = nT(p, vec2(1.0), vec2(0.5, 0.5));
  float isK = step(1.0 - uP0.w, kv.z);
  float knot = isK * (1.0 - smoothstep(0.035, 0.07, kv.x));
  float kInf = isK * exp(-kv.x * 5.0);
  float ny = max(1.0, floor(uP0.x * gT.y + 0.5));
  float r = (p.y / gT.y) * ny + w.x * uP0.y + w.y * uP0.y * 0.5 + kInf * 2.5;
  float ring = fract(r);
  float late = smoothstep(0.45, 0.85, ring) * (1.0 - smoothstep(0.88, 1.0, ring));
  float ringVar = 0.35 + 0.35 * (0.5 + 0.5 * lo.y);
  vec3 col = mix(uC0, uC1, late * ringVar);
  col *= 1.0 + 0.09 * fib + 0.06 * lo.z + 0.04 * w.z;
  float ray = uP1.z * smoothstep(0.35, 0.7, rayn);
  col = mix(col, uC0 * 1.15, ray * 0.5);
  float fig = uP1.w * smoothstep(0.15, 0.6, fign + 0.3 * w.x);
  col = mix(col, uC2, fig * 0.7);
  col = mix(col, uC1 * 0.7, knot * 0.8);
  float chk = uP1.y * (1.0 - smoothstep(0.0, 0.06, abs(chkn))) * step(0.0, chkm);
  col = mix(col, vec3(lum(col)) * vec3(1.02, 1.0, 0.95), uP1.y * 0.55);
  col *= 1.0 - 0.5 * chk;
  s.alb = col;
  s.h = -late * 0.0004 + fib * 0.00025 * (1.0 + uP0.z) - chk * 0.002 + knot * 0.0003 + lo.x * 0.0008;
  s.rough = uP1.x + 0.06 * fib + 0.08 * late + 0.1 * chk;
  s.ao = 1.0 - 0.5 * chk;
}`,
  },

  // Altar firewood: logs of fig, walnut and oil-tree (pine) — never olive or vine (Tamid 2:3).
  logs: {
    hRange: 0.09, ao: [0.05, 0.02, 0.6],
    src: /* glsl */`
// uP0: x mode (0 pile of round logs in rows, 1 bark surface with the species in large patches), y split-log share
// uC0 fig bark, uC1 walnut bark, uC2 pine bark, uC3 pine plate highlight, uC4 split wood
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  vec3 bh = blkHash(b, 707);
  bool bm = uP0.x > 0.5;   // uniform: bark mode samples tile-periodic noise, pile mode block-local noise
  float barkMode = bm ? 1.0 : 0.0;
  vec4 bpat = nT(p, vec2(0.8), vec2(0.33, 0.66));
  vec2 lp = vec2(b.lx, b.ly) + bh.yz * 23.0;
  float cre = (bm ? nT(p, vec2(6.0, 40.0), vec2(0.0)) : nL(lp, vec2(6.0, 40.0), vec2(0.0))).y;
  vec4 fv = bm ? nT(p, vec2(3.0), vec2(0.5)) : nL(lp, vec2(3.0), vec2(0.5));
  // walnut: deep interlacing furrows along the log (cell borders of a Voronoi stretched along u)
  vec4 wf = bm ? vT(p + fv.xy * 0.02, vec2(0.15, 0.03), vec2(0.41, 0.13)) : vL(lp + fv.xy * 0.02, vec2(0.15, 0.03), vec2(0.41, 0.13));
  // pine: irregular plates between dark fissures, flaking in thin layers
  vec4 pv = bm ? vT(p + fv.xy * 0.025, vec2(0.08, 0.045), vec2(0.0)) : vL(lp + fv.xy * 0.025, vec2(0.08, 0.045), vec2(0.0));
  float flk = (bm ? nT(p, vec2(30.0, 60.0), vec2(0.7, 0.1)) : nL(lp, vec2(30.0, 60.0), vec2(0.7, 0.1))).x;
  float fib = nL(lp, vec2(3.0, 220.0), vec2(0.27, 0.71)).y;      // split-face fibres
  // branch scars (all species): small dark rings with a raised lip
  vec4 kn = bm ? vT(p, vec2(0.3, 0.12), vec2(0.62, 0.18)) : vL(lp, vec2(0.3, 0.12), vec2(0.62, 0.18));
  float knot = step(0.88, kn.z) * (1.0 - smoothstep(0.12, 0.22, kn.x));
  float kLip = step(0.88, kn.z) * smoothstep(0.1, 0.2, kn.x) * (1.0 - smoothstep(0.2, 0.3, kn.x));
  // species: one per log in the pile; large soft-edged patches on the bark surface (Tamid 2:3)
  float sp = bm ? clamp(0.5 + bpat.z * 1.2, 0.0, 1.0) : bh.x;
  float wFig = bm ? 1.0 - smoothstep(0.26, 0.38, sp) : step(sp, 0.34);
  float wPine = bm ? smoothstep(0.62, 0.74, sp) : step(0.67, sp);
  float wWal = clamp(1.0 - wFig - wPine, 0.0, 1.0);
  float furrow = 1.0 - smoothstep(0.0, 0.16, wf.y);
  float fis = 1.0 - smoothstep(0.0, 0.08, pv.y);
  // fig: smooth bark with fine longitudinal wrinkles and ring-like creases across the log
  float ring = (bm ? nT(p, vec2(40.0, 5.0), vec2(0.52, 0.31)) : nL(lp, vec2(40.0, 5.0), vec2(0.52, 0.31))).y;
  float hFig = cre * 0.0008 + fv.x * 0.0012 - (1.0 - smoothstep(0.0, 0.12, abs(ring))) * 0.0012;
  float hWal = (1.0 - furrow) * 0.003 * (0.7 + 0.3 * wf.z) - furrow * 0.009 + fv.x * 0.0015;
  float hPine = -fis * 0.011 + (pv.z - 0.5) * 0.004 + flk * 0.0006 + fv.y * 0.0015;
  float bark = wFig * hFig + wWal * hWal + wPine * hPine + kLip * 0.004 - knot * 0.003;
  // fig: smooth warm grey, blotched; walnut: dark, furrows darker; pine: grey-brown plate faces over red-brown fissures
  vec3 cFig = uC0 * (1.0 + 0.06 * fv.z + 0.06 * cre - 0.12 * (1.0 - smoothstep(0.0, 0.12, abs(ring)))) * mix(1.0, 0.8, smoothstep(0.1, 0.7, fv.w));
  vec3 cWal = uC1 * (1.0 + 0.1 * fv.z + 0.06 * wf.z) * (1.0 - 0.35 * furrow);
  vec3 cPine = mix(uC3 * (0.88 + 0.24 * pv.z + 0.1 * flk), uC2, smoothstep(0.0, 0.5, fis)) * (1.0 - 0.6 * smoothstep(0.4, 1.0, fis));
  vec3 col = wFig * cFig + wWal * cWal + wPine * cPine;
  col *= 1.0 - wFig * (1.0 - smoothstep(0.0, 0.08, abs(cre))) * 0.06;   // fig lenticels
  col *= 1.0 - 0.45 * knot;
  float rough = 0.9 - 0.1 * wFig;
  float ao = 1.0 - 0.35 * (wWal * furrow + wPine * fis);
  // pile: a round log per block, its radius varying, the gaps between logs deep and dark
  float R = uRowH * 0.5 * (0.78 + 0.2 * bh.y);
  float t = (b.ly - uRowH * 0.5 - (bh.z - 0.5) * (uRowH - 2.0 * R)) / R;
  float rnd = sqrt(max(0.0, 1.0 - t * t));
  float endCap = smoothstep(0.0, 0.025, min(b.lx, b.len - b.lx));
  float split = step(1.0 - uP0.y, fract(bh.x * 7.77));
  float splitF = split * smoothstep(0.35, 0.5, rnd);
  float occ = smoothstep(0.0, 0.55, rnd) * endCap;
  float hLog = R * mix(rnd, min(rnd, 0.62), split) + bark * rnd * (1.0 - splitF);
  vec3 wood = uC4 * (1.0 + 0.12 * fib + 0.06 * fv.z);
  vec3 pcol = mix(col, wood, splitF) * mix(0.16, 1.0, occ);
  s.h = mix(mix(-0.02, hLog, endCap * step(0.0, 1.0 - abs(t))), bark, barkMode);
  s.alb = mix(pcol, col, barkMode);
  s.rough = mix(mix(rough, 0.8, splitF), rough, barkMode);
  s.ao = mix(ao * mix(0.15, 1.0, occ), ao, barkMode);
  s.a = b.lx / uDMax;
}`,
  },

  // End grain of a stacked pile (the faces where the logs end): one log end per block in rows, growth rings
  // around an off-centre pith, a bark rim, radial drying checks, dark gaps into the pile. Species per log.
  logend: {
    hRange: 0.05, ao: [0.02, 0.01, 0.5],
    src: /* glsl */`
// uP0: x ring spacing (m), y bark rim (m), z check amount, w gap depth (m)
// uC0 fig wood, uC1 walnut heartwood, uC2 pine wood, uC3 bark, uC4 walnut sapwood
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  vec3 bh = blkHash(b, 709);
  vec3 bk = blkHash(b, 711);
  vec2 lp = vec2(b.lx, b.ly) + bh.yz * 19.0;
  vec4 wn = nL(lp, vec2(6.0), vec2(0.2, 0.4));
  vec4 fn = nL(lp, vec2(45.0), vec2(0.6, 0.1));
  float saw = nL(lp, vec2(1.5, 70.0), vec2(0.37, 0.52)).y;
  float R = min(b.len, uRowH) * 0.5 * (0.74 + 0.26 * bh.y);
  vec2 cen = vec2(b.len * 0.5 + (bk.x - 0.5) * (b.len - 2.0 * R), uRowH * 0.5 + (bk.y - 0.5) * (uRowH - 2.0 * R));
  vec2 d = vec2(b.lx, b.ly) - cen;
  float r = length(d) / R + 0.05 * wn.y;
  float inLog = 1.0 - smoothstep(0.96, 1.0, r);
  // split billets: a flat split face through the log at a random angle
  float sa = bk.y * 6.2832;
  inLog *= mix(1.0, smoothstep(-0.004, 0.0, dot(d, vec2(cos(sa), sin(sa))) + R * 0.08), step(0.72, bh.z));
  vec2 pith = (bk.yz - 0.5) * R * 0.4;
  float rr = length(d - pith) + 0.004 * wn.x + 0.0015 * fn.z;
  float sp = bh.x;
  float isFig = step(sp, 0.34);
  float isPine = step(0.67, sp);
  float isWal = 1.0 - isFig - isPine;
  float ringW = uP0.x * (isPine > 0.5 ? 1.4 : (isFig > 0.5 ? 1.1 : 0.8));
  float ring = fract(rr / ringW);
  float late = smoothstep(0.55, 0.85, ring) * (1.0 - smoothstep(0.9, 1.0, ring));
  float barkIn = 1.0 - uP0.y / R * (0.8 + 0.4 * bk.z);
  float wood = 1.0 - smoothstep(barkIn - 0.02, barkIn, r);
  float ang = atan(d.y, d.x);
  float nChk = 2.0 + floor(bk.x * 3.0);
  float chk = uP0.z * (1.0 - smoothstep(0.0, 0.025 + 0.025 * r, abs(sin(ang * nChk * 0.5 + bh.z * 6.2832 + 0.15 * wn.z))))
            * smoothstep(0.2, 0.75, r) * step(0.3, bk.z);
  vec3 wc = isFig * uC0 + isPine * uC2 + isWal * mix(uC1, uC4, smoothstep(barkIn - 0.3, barkIn - 0.15, r));
  wc *= 1.0 - 0.18 * late * (isPine * 1.0 + isWal * 0.7 + isFig * 0.4);
  wc *= 1.0 + 0.06 * fn.x + 0.04 * saw + 0.05 * wn.w;
  vec3 col = mix(uC3 * (1.0 + 0.1 * fn.y), wc, wood);
  col *= 1.0 - 0.6 * chk;
  col = mix(vec3(0.05, 0.04, 0.032) * (1.0 + 0.6 * wn.w), col, inLog);
  s.alb = col;
  s.h = mix(-uP0.w, late * 0.0003 + saw * 0.0004 + fn.x * 0.0002 - chk * 0.004 + (1.0 - wood) * 0.003 * fn.y, inLog);
  s.rough = mix(0.95, 0.86 + 0.06 * (1.0 - wood), inLog);
  s.ao = mix(0.12, 1.0 - 0.4 * chk, inLog);
  s.a = b.lx / uDMax;
}`,
  },

  // Woven textiles. Plain weave of round, plied threads: shesh (six-ply linen); for the parochet every cord
  // twists all four materials — techelet, argaman, tola'at shani and shesh (Shekalim 8:5; Yoma 71b).
  // No figures are woven in (none attested for the Second-Temple parochot).
  weave: {
    hRange: 0.003, ao: [0.002, 0.0002, 0.6],
    src: /* glsl */`
// uP0: x pitch (m), y thread fill, z slub amount, w multicolour plies (1) or single colour (0)
// uP1: x twist pitch (m), y fuzz, z rough, w gap darkening
// uP2: x ply count, y weave (0 plain, 1 2/2 twill), z linen ply share (multicolour), w ply-share variation
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
  float shareN = nT(p, vec2(6.0), vec2(0.29, 0.63)).y;
  // plain weave: over 1 under 1; 2/2 twill: over 2 under 2, stepping one per row (floats twice as long)
  bool twill = uP2.y > 0.5;
  int k4 = (ci.x + ci.y) & 3;
  float up = twill ? float(k4 < 2) : float(((ci.x + ci.y) & 1) == 0);
  float aW = twill ? (float(k4 & 1) + f.y) * 0.5 : f.y;   // position along the current float, warp / weft
  float aF = twill ? (float(k4 & 1) + f.x) * 0.5 : f.x;
  // per-thread lookups at random offsets (a fixed stride across threads made a quasi-periodic plaid)
  float tw = 1.0 + uP0.z * textureLod(tN, vec2(h1(ivec2(ci.x, 33)), p.y / uTile.y), 0.0).x;
  float tf = 1.0 + uP0.z * textureLod(tN, vec2(p.x / uTile.x, h1(ivec2(ci.y, 35))), 0.0).y;
  float hw = threadH(f.x * 2.0 - 1.0, aW, up, uP0.y * tw);
  float hf = threadH(f.y * 2.0 - 1.0, aF, 1.0 - up, uP0.y * tf);
  bool showWarp = hw >= hf;
  float h = max(hw, hf);
  float across = showWarp ? (f.x * 2.0 - 1.0) : (f.y * 2.0 - 1.0);
  float along = showWarp ? p.y : p.x;
  int thr = showWarp ? ci.x : ci.y + 4096;
  // ply helix: half a turn across the visible face of the cord
  float ph = along / uP1.x + across * 0.25 + h1(ivec2(thr, 77));
  float tn = textureLod(tN, vec2(h1(ivec2(thr, 31)), along / uTile.y), 0.0).z;
  vec3 col;
  if (uP0.w > 0.5) {
    // four plies — techelet, argaman, tola'at shani, shesh — the (finer) linen ply taking a smaller share,
    // varying a little from cord to cord and across the cloth
    float wl = clamp(uP2.z * (1.0 + uP2.w * shareN), 0.04, 0.5);
    float c1 = (1.0 - wl) / 3.0;
    float fr = fract(ph);
    float dB = min(min(fr, 1.0 - fr), min(abs(fr - c1), min(abs(fr - 2.0 * c1), abs(fr - 3.0 * c1))));
    h *= 0.84 + 0.16 * smoothstep(0.0, 0.07, dB);
    col = fr < c1 ? uC1 : (fr < 2.0 * c1 ? uC2 : (fr < 3.0 * c1 ? uC3 : uC4));
    vec3 mean = (uC1 + uC2 + uC3) * c1 + uC4 * wl;
    col = mix(col, mean, 0.22);                       // wool fuzz scatters light across the ply boundaries
    col *= 1.0 + 0.03 * tn;
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

  // Soreg screen: long and short wooden slats crossed diagonally, open between (Middot 2:3 with Bartenura).
  // Alpha = slat coverage (alpha-tested cut-out).
  lattice: {
    hRange: 0.03, ao: [0.02, 0.01, 0.6],
    src: /* glsl */`
// uP0: x spacing (m, perpendicular), y slat width, z slat thickness;  uC0 wood, uC1 wood dark
void surf(vec2 p, inout S s) {
  float warp = nT(p, vec2(3.0), vec2(0.0)).x;
  float gn = nT(p, vec2(20.0), vec2(0.3, 0.3)).y;
  float sp = uP0.x;
  vec2 d = vec2(p.x + p.y, p.x - p.y) * 0.70710678;
  vec2 fd = mod(d, sp) - 0.5 * sp;
  float w = uP0.y * 0.5;
  float inA = 1.0 - smoothstep(w - 0.0015, w, abs(fd.x));
  float inB = 1.0 - smoothstep(w - 0.0015, w, abs(fd.y));
  float profA = sqrt(max(0.0, 1.0 - pow(fd.x / w, 2.0)));
  float profB = sqrt(max(0.0, 1.0 - pow(fd.y / w, 2.0)));
  float hA = inA * (uP0.z + 0.003 * profA);
  float hB = inB * (0.003 * profB);
  bool a = hA >= hB && inA > 0.0;
  float across = a ? fd.x : fd.y;
  float grain = 0.5 + 0.5 * sin(across / w * 9.0 + warp * 6.0);
  vec3 col = mix(uC0, uC1, grain * 0.35 + 0.15 * gn);
  float shade = a ? 1.0 : (0.7 + 0.3 * smoothstep(w, w * 2.5, abs(fd.x)));
  s.alb = col * shade;
  s.h = max(hA, hB) + grain * 0.0004;
  s.rough = 0.82;
  s.ao = shade;
  s.a = clamp(inA + inB, 0.0, 1.0);
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
  detail: {
    hRange: 0.0006, ao: [0.001, 0.0001, 0.0], detail: true,
    src: /* glsl */`
// uP0.x mode: 0 stone, 1 metal, 2 wood, 3 cloth
void surf(vec2 p, inout S s) {
  int m = int(uP0.x + 0.5);
  vec4 v = vT(p, vec2(m == 1 ? 0.006 : 0.0016), vec2(0.0));
  vec4 pv = vT(p, vec2(0.004), vec2(0.5, 0.5));
  vec4 g = nT(p, vec2(m == 3 ? 300.0 : (m == 2 ? 80.0 : 120.0)), vec2(0.3, 0.1));
  vec4 a1 = nT(p, m == 1 ? vec2(8.0, 900.0) : vec2(10.0, 1400.0), vec2(0.2, 0.3));
  float scr2 = nT(p, vec2(700.0, 12.0), vec2(0.6, 0.1)).x;
  float pit = step(0.9, pv.z) * (1.0 - smoothstep(0.15, 0.4, pv.x));
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
  } else {
    h = g.x * 0.00004;
    al = 0.5 + g.x * 0.08;
    ro = 0.5 + g.x * 0.1;
  }
  s.alb = vec3(al);
  s.rough = ro;
  s.h = h;
}`,
  },
};

export const KIND_PRELUDE = '';

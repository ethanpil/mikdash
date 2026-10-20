// Generator kinds: wood, logs, bark, charred wood and coal beds (see kinds.js for the conventions).

export const WOOD_KINDS = {
  // Wood: grain along u (uP3.w = 1 rotates the grain to run along v; the *_v keys now swap UVs in the material
  // instead, so they share the u set).
  wood: {
    hRange: 0.006, ao: [0.01, 0.0008, 0.5],
    src: /* glsl */`
// uP0: x rings per m (across grain), y ring warp, z pore amp, w knot density
// uP1: x rough, y weathering, z rays (oak), w figure (olive);  uC0 earlywood, uC1 latewood, uC2 figure / weathered
// uP2: x riven relief (m: a face split along the grain — long torn ridges and splinters, no saw or plane marks),
//      y check depth (m)
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
  float rv1 = nT(p, vec2(0.8, 26.0), vec2(0.23, 0.71)).z;    // riven ridges: long along the grain, ~4 cm across
  float rv2 = nT(p, vec2(2.5, 90.0), vec2(0.81, 0.37)).x;    // torn fibres between them, ~1 cm
  float rv3 = nT(p, vec2(6.0, 260.0), vec2(0.47, 0.13)).y;   // splinters
  float isK = step(1.0 - uP0.w, kv.z);
  float knot = isK * (1.0 - smoothstep(0.035, 0.07, kv.x));
  float kInf = isK * exp(-kv.x * 5.0);
  float ny = max(1.0, floor(uP0.x * gT.y + 0.5));
  float riven = step(0.0001, uP2.x);
  // a riven face follows the fibres: its rings run as long wavy streaks (more warp), not a planed board's even lines
  float r = (p.y / gT.y) * ny + w.x * uP0.y * (1.0 + 1.5 * riven) + w.y * uP0.y * 0.5 + kInf * 2.5;
  float ring = fract(r);
  float late = smoothstep(0.45, 0.85, ring) * (1.0 - smoothstep(0.88, 1.0, ring));
  float ringVar = 0.35 + 0.35 * (0.5 + 0.5 * lo.y);
  vec3 col = mix(uC0, uC1, late * ringVar * (1.0 - 0.45 * riven));
  col *= 1.0 + 0.09 * fib + 0.06 * lo.z + 0.04 * w.z;
  float ray = uP1.z * smoothstep(0.35, 0.7, rayn);
  col = mix(col, uC0 * 1.15, ray * 0.5);
  float fig = uP1.w * smoothstep(0.15, 0.6, fign + 0.3 * w.x);
  col = mix(col, uC2, fig * 0.7);
  col = mix(col, uC1 * 0.7, knot * 0.8);
  float chk = uP1.y * (1.0 - smoothstep(0.0, 0.06, abs(chkn))) * step(0.0, chkm);
  col = mix(col, vec3(lum(col)) * vec3(1.02, 1.0, 0.95), uP1.y * 0.55);
  col *= 1.0 - 0.5 * chk;
  // riven: sharp torn ridges (ridged noise) with splinters lifting off them; fresh fibres on the crests catch the
  // light, the hollows between are darker and rougher
  float rid1 = 1.0 - abs(rv1);
  float rid2 = 1.0 - abs(rv2);
  float riv = uP2.x * (rid1 * rid1 * 0.7 + rid2 * rid2 * 0.3 + 0.15 * rv3);
  float crest = riven * smoothstep(0.45, 0.95, rid1 * 0.7 + rid2 * 0.3);
  col *= 1.0 + riven * (0.12 * crest - 0.14 * (1.0 - smoothstep(0.2, 0.6, rid1)) + 0.05 * rv3);
  s.alb = col;
  s.h = -late * 0.0004 * (1.0 - riven) + fib * 0.00025 * (1.0 + uP0.z) - chk * (0.002 + uP2.y) + knot * 0.0003 + lo.x * 0.0008 + riv;
  s.rough = uP1.x + 0.06 * fib + 0.08 * late * (1.0 - riven) + 0.1 * chk + riven * (0.06 - 0.08 * crest);
  s.ao = 1.0 - 0.5 * chk - riven * 0.25 * (1.0 - smoothstep(0.1, 0.5, rid1));
}`,
  },

  // Altar firewood pile: logs of fig, walnut and oil-tree (pine) — never olive or vine (Tamid 2:3) — one species
  // per log in rows (uP0.x = 0). (uP0.x = 1, the old bark surface with species in patches, is superseded by `bark`.)
  logs: {
    hRange: 0.09, ao: [0.05, 0.02, 0.6],
    src: /* glsl */`
// uP0: x mode (0 pile of round logs in rows), y split-log share, z softness
// uC0 fig bark, uC1 walnut bark, uC2 pine bark, uC3 pine plate highlight, uC4 split wood
void surf(vec2 p, inout S s) {
  Blk b = blk(p);
  vec3 bh = blkHash(b, 707);
  vec2 lp = vec2(b.lx, b.ly) + bh.yz * 23.0;
  float cre = nL(lp, vec2(6.0, 40.0), vec2(0.0)).y;
  vec4 fv = nL(lp, vec2(3.0), vec2(0.5));
  // walnut: furrows along the log; pine: irregular plates between dark fissures, flaking in thin layers
  vec4 wf = vL(lp + fv.xy * 0.02, vec2(0.15, 0.03), vec2(0.41, 0.13));
  vec4 pv = vL(lp + fv.xy * 0.025, vec2(0.08, 0.045), vec2(0.0));
  float flk = nL(lp, vec2(30.0, 60.0), vec2(0.7, 0.1)).x;
  float fib = nL(lp, vec2(3.0, 220.0), vec2(0.27, 0.71)).y;      // split-face fibres
  vec4 kn = vL(lp, vec2(0.3, 0.12), vec2(0.62, 0.18));
  float knot = step(0.88, kn.z) * (1.0 - smoothstep(0.12, 0.22, kn.x));
  float kLip = step(0.88, kn.z) * smoothstep(0.1, 0.2, kn.x) * (1.0 - smoothstep(0.2, 0.3, kn.x));
  float sp = bh.x;
  float wFig = step(sp, 0.34);
  float wPine = step(0.67, sp);
  float wWal = clamp(1.0 - wFig - wPine, 0.0, 1.0);
  float furrow = 1.0 - smoothstep(0.0, 0.16, wf.y);
  float fis = 1.0 - smoothstep(0.0, 0.08, pv.y);
  float ring = nL(lp, vec2(40.0, 5.0), vec2(0.52, 0.31)).y;
  float hFig = cre * 0.0008 + fv.x * 0.0012 - (1.0 - smoothstep(0.0, 0.12, abs(ring))) * 0.0012;
  float hWal = (1.0 - furrow) * 0.003 * (0.7 + 0.3 * wf.z) - furrow * 0.009 + fv.x * 0.0015;
  float hPine = -fis * 0.011 + (pv.z - 0.5) * 0.004 + flk * 0.0006 + fv.y * 0.0015;
  float bark = wFig * hFig + wWal * hWal + wPine * hPine + kLip * 0.004 - knot * 0.003;
  vec3 cFig = uC0 * (1.0 + 0.06 * fv.z + 0.06 * cre - 0.12 * (1.0 - smoothstep(0.0, 0.12, abs(ring)))) * mix(1.0, 0.8, smoothstep(0.1, 0.7, fv.w));
  vec3 cWal = uC1 * (1.0 + 0.1 * fv.z + 0.06 * wf.z) * (1.0 - 0.35 * furrow);
  vec3 cPine = mix(uC3 * (0.88 + 0.24 * pv.z + 0.1 * flk), uC2, smoothstep(0.0, 0.5, fis)) * (1.0 - 0.6 * smoothstep(0.4, 1.0, fis));
  vec3 col = wFig * cFig + wWal * cWal + wPine * cPine;
  col *= 1.0 - wFig * (1.0 - smoothstep(0.0, 0.08, abs(cre))) * 0.06;   // fig lenticels
  col *= 1.0 - 0.45 * knot;
  float rough = 0.9 - 0.1 * wFig;
  float ao = 1.0 - 0.35 * (wWal * furrow + wPine * fis);
  // a round log per block, its radius varying, the gaps between logs deep and dark
  float R = uRowH * 0.5 * (0.78 + 0.2 * bh.y);
  float t = (b.ly - uRowH * 0.5 - (bh.z - 0.5) * (uRowH - 2.0 * R)) / R;
  float rnd = sqrt(max(0.0, 1.0 - t * t));
  float endCap = smoothstep(0.0, 0.025, min(b.lx, b.len - b.lx));
  float split = step(1.0 - uP0.y, fract(bh.x * 7.77));
  float splitF = split * smoothstep(0.35, 0.5, rnd);
  float occ = smoothstep(0.0, 0.55, rnd) * endCap;
  float hLog = R * mix(rnd, min(rnd, 0.62), split) + bark * rnd * (1.0 - splitF);
  vec3 wood = uC4 * (1.0 + 0.12 * fib + 0.06 * fv.z);
  s.h = mix(-0.02, hLog, endCap * step(0.0, 1.0 - abs(t)));
  s.alb = mix(col, wood, splitF) * mix(0.16, 1.0, occ);
  s.rough = mix(rough, 0.8, splitF);
  s.ao = ao * mix(0.15, 1.0, occ);
  s.a = b.lx / uDMax;
}`,
  },

  // Bark of one species per set (materials-2-fix: a log keeps one species along its whole length — the old surface
  // with species in tile-sized patches turned single logs into camouflage). Grain along u (the log's length).
  //   0 fig:    smooth silvery-grey bark, fine wrinkles, horizontal lenticels, faint ring creases, a few dark blotches
  //   1 walnut: grey ridges and deep dark furrows (5-9 mm) that split and merge into a long interlaced net
  //   2 pine (Aleppo, the "oil tree" of Tamid 2:3): long irregular plates, grey-brown faces flaking in layers, over
  //             red-brown fissures; plates elongated along the trunk (round plates read as reptile scales)
  //   3 olive:  grey bark of an old olive, twisted fissures running at a slant, shallow plates, lichen spots
  // Branch scars on all.
  bark: {
    hRange: 0.02, ao: [0.02, 0.006, 0.6],
    src: /* glsl */`
// uP0: x species (0 fig, 1 walnut, 2 pine, 3 olive), y relief (m), z twist (rad, olive), w lichen
// uC0 bark face, uC1 bark dark (furrow / fissure), uC2 inner bark (pine red-brown), uC3 highlight, uC4 lichen
void surf(vec2 p, inout S s) {
  int sp = int(uP0.x + 0.5);
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  vec2 q = rot2(p, uP0.z);
  vec4 wp = nT(p, vec2(2.0, 6.0), vec2(0.0));
  vec4 fA = nT(p, vec2(1.6, 4.0), vec2(0.27, 0.41));      // walnut: the wander of the furrows
  vec4 fB = nT(p, vec2(2.0, 5.0), vec2(0.63, 0.17));      // the second family's wander
  vec4 pv = vT(p + wp.xy * 0.03, vec2(0.2, 0.045), vec2(0.31, 0.59));   // pine plates, elongated along the trunk
  vec4 pv2 = vT(p + wp.zw * 0.02, vec2(0.05, 0.02), vec2(0.71, 0.23));  // flakes on a plate
  vec4 oA = nT(q + wp.xy * 0.03, vec2(2.0, 16.0), vec2(0.45, 0.83));    // olive twisted fissures
  vec4 oP = vT(q + wp.zw * 0.03, vec2(0.09, 0.04), vec2(0.17, 0.37));   // olive plates
  vec4 g = nT(p, vec2(60.0), vec2(0.5, 0.2));
  vec4 m = nT(p, vec2(1.5), vec2(0.8, 0.6));
  float wr = nT(p, vec2(8.0, 120.0), vec2(0.13, 0.57)).y;               // fine longitudinal wrinkles (fig)
  float rc = nT(p, vec2(30.0, 3.0), vec2(0.52, 0.31)).y;                // ring creases across the log (fig)
  vec4 lv = vT(p, vec2(0.03, 0.012), vec2(0.88, 0.44));                 // lenticels (fig): short horizontal dashes
  vec4 kn = vT(p, vec2(0.35, 0.18), vec2(0.62, 0.18));                  // branch scars
  vec4 li = nT(p, vec2(5.0), vec2(0.37, 0.91));
  float knot = step(0.9, kn.z) * (1.0 - smoothstep(0.1, 0.2, kn.x));
  float kLip = step(0.9, kn.z) * smoothstep(0.1, 0.18, kn.x) * (1.0 - smoothstep(0.2, 0.3, kn.x));
  float H = uP0.y;
  float h = 0.0;
  vec3 col = uC0;
  float rough = 0.85;
  float ao = 1.0;
  float wF = max(0.12, tex * 2.5 / 0.04);           // furrow half-width in noise units, never under ~2.5 texels
  if (sp == 0) {
    float lent = step(0.6, lv.z) * (1.0 - smoothstep(0.18, 0.36, lv.x)) * smoothstep(0.8, 2.0, 0.012 / tex);
    float crease = 1.0 - smoothstep(0.0, 0.15, abs(rc));
    h = H * (0.25 * wr + 0.5 * m.x) - 0.0006 * crease + 0.0004 * lent;
    col = uC0 * (1.0 + 0.05 * m.y + 0.03 * wr + 0.04 * g.x) * mix(1.0, 0.82, smoothstep(0.35, 0.8, m.w));
    col = mix(col, uC1, crease * 0.25);
    col = mix(col, uC3, lent * 0.5);
    rough = 0.72 + 0.06 * m.z;
  } else if (sp == 1) {
    // two families of long furrows wandering along the log and crossing at small angles: the interlaced diamonds
    float nF = max(4.0, floor(gT.y / 0.03 + 0.5));
    float y1 = p.y / gT.y * nF + 4.0 * p.x / gT.x + 0.9 * fA.z + 0.06 * fA.x;
    float y2 = p.y / gT.y * nF - 4.0 * p.x / gT.x + 0.9 * fB.z + 0.06 * fB.x + 0.5;
    float wW = max(0.2, tex * 1.5 / (gT.y / nF));
    float f1 = 1.0 - smoothstep(0.0, wW, abs(fract(y1) - 0.5));
    float f2 = (1.0 - smoothstep(0.0, wW * 0.85, abs(fract(y2) - 0.5))) * smoothstep(-0.1, 0.35, fA.y);
    float fur = max(f1, f2);
    float ridgeTop = 1.0 - fur;
    h = -H * fur * (0.8 + 0.2 * fA.w) + 0.0008 * g.x * ridgeTop + 0.001 * m.x;
    col = mix(uC0 * (1.0 + 0.08 * fA.y + 0.05 * g.y), uC1, smoothstep(0.1, 0.9, fur));
    rough = 0.88 + 0.05 * fur;
    ao = 1.0 - 0.45 * fur;
  } else if (sp == 2) {
    float fis = 1.0 - smoothstep(0.0, max(0.07, tex * 2.0 / 0.045), pv.y);
    float flake = smoothstep(0.0, 0.12, pv2.y) * step(0.5, pv2.z);
    h = -H * fis + 0.004 * (pv.z - 0.5) * (1.0 - fis) + 0.0008 * flake + 0.0006 * g.x;
    // plate faces grey-brown, here and there a flake gone to show the red-brown inner bark; fissures dark
    vec3 face = uC0 * (0.9 + 0.2 * pv.z + 0.06 * g.x) * (1.0 - 0.08 * flake);
    face = mix(face, uC3, 0.25 * smoothstep(0.5, 1.0, fract(pv.z * 5.3)));
    face = mix(face, uC2 * (0.9 + 0.2 * g.y), 0.55 * step(0.78, pv2.z) * smoothstep(0.05, 0.2, pv2.y));
    col = mix(face, uC1 * (0.9 + 0.2 * g.y), smoothstep(0.2, 0.9, fis));
    rough = 0.86;
    ao = 1.0 - 0.4 * fis;
  } else {
    float of = 1.0 - smoothstep(0.0, max(0.06, tex * 2.0 / 0.06), abs(oA.x));
    float pl = 1.0 - smoothstep(0.0, max(0.06, tex * 2.0 / 0.04), oP.y);
    float fis = max(of, pl * 0.4) * 0.8;
    h = -H * fis + 0.0015 * m.x + 0.0008 * g.x + 0.002 * oA.x;
    col = mix(uC0 * (1.0 + 0.07 * oA.y + 0.05 * g.y + 0.04 * m.y), uC1, smoothstep(0.1, 0.9, fis));
    rough = 0.86;
    ao = 1.0 - 0.4 * fis;
  }
  float lich = uP0.w * smoothstep(0.55, 0.85, li.x + 0.3 * g.z) * (1.0 - 0.7 * (1.0 - ao));
  col = mix(col, uC4 * (0.85 + 0.3 * g.w), lich * 0.6);
  h += kLip * 0.004 - knot * 0.004;
  col *= 1.0 - 0.45 * knot;
  s.h = h;
  s.alb = col;
  s.rough = rough;
  s.ao = ao * (1.0 - 0.3 * knot);
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

  // Fire-touched wood. uP0.x = 0: charred wood — "alligator" char: the surface cracked across and along the grain
  // into rectangular checks (longer along the grain, u), each a cushion with rounded edges and a satin, silvery-black
  // sheen on its crest, deep dark cracks, a little ash in them. 1: a coal bed — clustered lumps of charcoal half
  // buried in drifts of ash; the albedo alpha carries the GLOW mask (cracks in hot lumps, seams in the ash over them),
  // which the embers material reads as emission.
  char: {
    hRange: 0.04, ao: [0.015, 0.006, 0.5],
    src: /* glsl */`
// uP0: x mode
// uP1: x check length along the grain (m), y check width across (m), z ash share, w crack depth (m)
// uC0 char black, uC1 char sheen grey, uC2 ash
void surf(vec2 p, inout S s) {
  bool bed = uP0.x > 0.5;
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  vec4 n = nT(p, vec2(3.0), vec2(0.2, 0.5));
  vec4 g = nT(p, vec2(80.0), vec2(0.5, 0.1));
  vec4 wq = nT(p, vec2(6.0), vec2(0.15, 0.85));
  vec4 f = nT(p, vec2(6.0, 70.0), vec2(0.6, 0.3));
  // ---- charred wood: polygonal blocks elongated along the grain (anisotropic Voronoi: the cracks are straight
  // bisectors), flat-topped with rounded arrises, satin; deep dark cracks with a little ash
  vec4 bv = vT(p + wq.xy * 0.004, uP1.xy, vec2(0.29, 0.53));
  float eB = 0.5 * (bv.w - bv.x) * min(uP1.x, uP1.y);
  float rows = max(8.0, floor(uTile.y / max(uP1.y, 0.004) + 0.5));
  float ry = p.y / uTile.y * rows + 0.12 * wq.x;
  float ri = floor(ry);
  float fy = fract(ry);
  float nk = max(4.0, floor(uTile.x / (uP1.x * (0.7 + 0.6 * h1(ivec2(int(ri), 17)))) + 0.5));
  float cx = p.x / uTile.x * nk + h1(ivec2(int(ri), 29)) + 0.28 * wq.y + 0.12 * n.w;
  float fx = fract(cx);
  float ex = min(fx, 1.0 - fx) * uTile.x / nk;      // m to the nearest cross crack
  float ey = min(fy, 1.0 - fy) * uTile.y / rows;     // m to the nearest along-grain crack
  float rowCrack = step(0.25, h1(ivec2(int(ri), 41)));   // most row boundaries open (along the grain)
  float eyc = mix(ey + 0.01, ey, rowCrack);
  float e = eB + 0.0 * min(ex, eyc);
  float cw = max(0.0016, tex * 1.2);
  float crack = 1.0 - smoothstep(cw * 0.6, cw * 1.3, e);
  float cush = smoothstep(cw, cw + 0.003, e);
  float sub = 0.0;
  float hC = cush * 0.004 - crack * uP1.w - sub * 0.0012 + f.x * 0.0007 * cush + n.x * 0.002;
  vec3 cC = mix(uC0, uC1, cush * (0.18 + 0.3 * smoothstep(-0.2, 0.6, g.x)) * smoothstep(-0.5, 0.6, f.y));
  float ashC = uP1.z * (crack * 0.6 + smoothstep(0.3, 0.8, n.z + 0.25 * g.y) * 0.4 * cush);
  cC = mix(cC, uC2 * (0.8 + 0.2 * g.z), ashC * 0.65);
  cC *= 1.0 - 0.55 * crack - 0.25 * sub;
  float rC = mix(mix(0.8, 0.66 + 0.08 * g.x, smoothstep(0.4, 0.95, cush)), 0.95, max(crack, ashC));
  cC *= 0.85 + 0.3 * h1(ivec2(int(floor(cx)) & 1023, int(ri) & 1023));
  // ---- coal bed: lumps of two sizes in clusters (most of the bed ash, regions of exposed coal), each lump rounded and
  // dusted with ash on its top; ash in drifts; hot lumps cracked
  vec4 cv = vT(p + wq.xy * 0.02, vec2(0.055), vec2(0.71, 0.17));
  vec4 cv2 = vT(p + 0.21 + wq.zw * 0.01, vec2(0.03), vec2(0.13, 0.42));
  vec4 clu = nT(p, vec2(2.2), vec2(0.83, 0.41));
  vec4 hv = nT(p, vec2(4.0), vec2(0.36, 0.72));
  vec4 lc = vT(p + wq.yx * 0.01, vec2(0.012), vec2(0.47, 0.29));
  float cluster = smoothstep(-0.25, 0.35, clu.x + 0.3 * n.y);
  float lump = smoothstep(0.02, 0.1, cv.w - cv.x) * (1.0 - smoothstep(0.36, 0.5, cv.x + 0.06 * wq.z)) * step(0.15, cv.z);
  float lump2 = smoothstep(0.02, 0.1, cv2.w - cv2.x) * (1.0 - smoothstep(0.32, 0.46, cv2.x)) * step(0.4, cv2.z);
  float coal = max(lump, lump2 * 0.85) * cluster;
  float lDome = max(sqrt(clamp(1.0 - cv.x / 0.5, 0.0, 1.0)) * lump, sqrt(clamp(1.0 - cv2.x / 0.46, 0.0, 1.0)) * lump2 * 0.7) * cluster;
  float ashCover = clamp(smoothstep(-0.3, 0.4, -clu.x + 0.35 * n.y + 0.2 * wq.w) * (1.0 - 0.6 * coal) + (1.0 - coal) * 0.6, 0.0, 1.0);
  float dustTop = coal * smoothstep(0.55, 0.95, lDome) * smoothstep(-0.1, 0.5, g.y) * 0.6;
  float heat = smoothstep(-0.25, 0.55, hv.x + 0.4 * hv.y);
  float lCrack = coal * (1.0 - smoothstep(0.0, max(0.06, tex / 0.012), lc.y));
  float vis = coal * (1.0 - ashCover);
  float glow = clamp((vis * (0.25 + 0.75 * lCrack) + (1.0 - smoothstep(0.0, 0.08, cv.y)) * ashCover * coal * 0.4) * heat, 0.0, 1.0);
  float hB = lDome * 0.022 + ashCover * 0.006 * (0.5 + 0.5 * clu.y) + n.x * 0.004 + g.x * 0.0004 - lCrack * 0.002;
  vec3 aCol = uC2 * (0.8 + 0.18 * clu.z + 0.08 * g.y + 0.06 * n.w);
  vec3 coalC = uC0 * (0.85 + 0.35 * lDome + 0.1 * g.x);
  vec3 cB = mix(mix(coalC, aCol, dustTop), aCol, ashCover) * (1.0 - 0.45 * glow);
  float rB = mix(mix(0.5 + 0.15 * (1.0 - lDome), 0.9, dustTop), 0.97, ashCover);
  s.h = bed ? hB : hC;
  s.alb = bed ? cB : cC;
  s.rough = bed ? rB : rC;
  s.ao = bed ? 1.0 - 0.3 * lCrack : 1.0 - 0.5 * crack;
  s.a = bed ? glow : 1.0;
}`,
  },
};

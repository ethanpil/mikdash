// Generator kind: the Kodesh's carved walls under fitted gold (Middot 4:1; Yoma 54a "keruvim d'tzurta"; the
// 1 Melachim 6:29 programme of keruvim, palms and open flowers). A modelled bas-relief, in METRES of relief:
// every part is a signed-distance shape (smooth unions where parts grow into each other) given a domed or cushioned
// cross-section, so the light models volume instead of lighting flat plateaus; overlaps (the near arm over the
// body, the body over the wings) keep a fine contour groove. Silhouette edges are rounded over at least ~3 texels;
// small features (nose, lips, eye, fingers) get their own narrower rounding so they survive at the head's scale.
//
// The keruv (materials-2-fix redraw): a CHILD in profile facing the palm — a large round head under a cap of short
// curls, a child's face (rounded brow, small nose, full cheek, soft lips and chin; Sukkah 5b, Chagigah 13b
// "ke-ravya"), short neck, chubby body in a boy's short belted tunic with soft folds and short sleeves, a plump arm
// raised toward the palm, knees, calves and feet; two wings rising upward from the shoulder blades close behind the
// head (Shemot 25:20 "spreading their wings upward"), their tips curving forward toward the palm, the far wing
// tilted back behind the near one — marginal and greater coverts over long flight feathers with rounded tips.
// A pair faces each palm; between palms the keruvim stand back to back. The palm: a slightly curving trunk of
// overlapping leaf-base scales, arched drooping fronds with leaflets, two hanging date clusters. Drawing and
// proportions are reconstruction.

const SDF = /* glsl */`
float sdEll(vec2 p, vec2 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
// a tapered limb from a (radius ra) to b (radius rb)
float sdLimb(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 ba = b - a;
  float l = length(ba);
  vec2 dir = ba / l;
  vec2 q = vec2(abs(dot(p - a, vec2(dir.y, -dir.x))), dot(p - a, dir));
  float b2 = (ra - rb) / l;
  float a2 = sqrt(max(1.0 - b2 * b2, 0.0));
  float k = dot(q, vec2(-b2, a2));
  float d = dot(q, vec2(a2, b2)) - ra;
  d = k < 0.0 ? length(q) - ra : d;
  d = k > a2 * l ? length(q - vec2(0.0, l)) - rb : d;
  return d;
}
// relief of a shape: a rounded silhouette edge (re) rising to a domed interior (R: the distance from the edge at
// which the dome tops out)
float dome(float d, float H, float R, float re) {
  float e = smoothstep(0.0, re, -d);
  float b = pow(clamp(-d / R, 0.0, 1.0), 0.6);
  return H * e * (0.38 + 0.62 * b);
}
float groove(float d, float w) { return 1.0 - smoothstep(0.0, w, abs(d)); }
`;

export const RELIEF_KINDS = {
  relief: {
    hRange: 0.03, ao: [0.02, 0.004, 0.45],
    src: SDF + /* glsl */`
// uP0: x (unused), y band height (m), z module width (m), w seam gap (m)
// uP1: x rough on raised, y rough in recesses, z hammer dish depth (m), w blow-to-blow roughness (±; qa-r2: the gold
//      beaten over the carving varies with the hammering, 0.25–0.4, so the relief's facets catch the light one by one)

// ---------------------------------------------------------------- open flowers (the bands)
float rosette(vec2 q, float R, float re) {
  float r = length(q);
  float a = atan(q.y, q.x);
  float pet = 0.5 + 0.5 * cos(a * 8.0);
  float edge = R * (0.62 + 0.38 * pow(pet, 0.45));
  float d = r - edge;
  float body = dome(d, 0.0085, R * 0.5, re);
  float vein = (1.0 - smoothstep(0.0, 0.1, pet)) * smoothstep(R * 0.3, R * 0.45, r);
  float cup = smoothstep(R * 0.2, R * 0.95, r) * 0.0015;
  float centre = dome(r - R * 0.22, 0.0105, R * 0.2, re * 0.6);
  float seeds = 0.0006 * (0.5 + 0.5 * sin(q.x * 260.0) * sin(q.y * 260.0)) * step(r, R * 0.2);
  return max(body - 0.002 * vein + cup * step(0.0, -d), centre + seeds);
}

// ---------------------------------------------------------------- the palm
// one frond: from the crown at base angle ang (from vertical), arching out and drooping; leaflets along it
float frondH(vec2 v, float ang, float re) {
  float L = 0.46 - 0.06 * abs(ang);
  vec2 dir = vec2(sin(ang), cos(ang));
  float g = 0.35 + 0.8 * abs(ang);                // droop grows for the outer fronds
  float u = clamp(dot(v, dir), 0.0, L);
  vec2 P = dir * u - vec2(0.0, g * u * u);
  vec2 T = normalize(dir - vec2(0.0, 2.0 * g * u));
  u = clamp(u + dot(v - P, T), 0.0, L);           // one refinement toward the curve
  P = dir * u - vec2(0.0, g * u * u);
  T = normalize(dir - vec2(0.0, 2.0 * g * u));
  vec2 N = vec2(-T.y, T.x);
  float across = dot(v - P, N);
  float t = u / L;
  float lf = fract(u / 0.019 + abs(across) * 24.0);          // leaflets slanting out from the midrib
  float w = mix(0.052, 0.007, t * t) * (0.72 + 0.28 * smoothstep(0.0, 0.35, lf));
  float d = max(abs(across) - w, max(dot(v - P, T) - 0.004, -u));
  float rib = groove(across, 0.004);
  float leaf = 0.5 + 0.5 * cos(lf * TAU);
  return dome(d, mix(0.0095, 0.005, t), 0.012, re) * (0.62 + 0.38 * leaf) + 0.0012 * rib * step(d, 0.0);
}
float palmH(vec2 q, float re) {
  float yc = 1.35;
  float bend = 0.014 * sin(q.y * 2.6 + 0.4);
  float x = q.x - bend;
  float hw = mix(0.058, 0.04, clamp(q.y / yc, 0.0, 1.0));
  float dT = max(abs(x) - hw, max(0.02 - q.y, q.y - yc));
  // the stubs of old leaf bases in a criss-cross (diamond) pattern up the trunk, each a low cushion
  float g1 = abs(fract((q.y + 0.7 * x) / 0.048) - 0.5);
  float g2 = abs(fract((q.y - 0.7 * x) / 0.048) - 0.5);
  float dia = min(g1, g2);
  float scale = smoothstep(0.0, 0.2, dia) * 0.0017 - 0.0006 * (1.0 - smoothstep(0.0, 0.07, dia));
  float cyl = sqrt(max(0.0, 1.0 - pow(x / (hw + 0.006), 2.0)));
  float trunk = smoothstep(0.0, re, -dT) * (0.007 + 0.006 * cyl) + scale * step(dT, 0.0) * cyl;
  vec2 v = q - vec2(bend + 0.004, yc);
  float th = atan(v.x, v.y);
  float rr = length(v);
  float tc = th - sign(th) * 0.7 * rr;            // undo the droop roughly before picking the nearest fronds
  float i0 = clamp(floor((tc + 1.36) / 0.34 + 0.5), 0.0, 8.0);
  float f0 = frondH(v, -1.36 + i0 * 0.34, re);
  float f1 = frondH(v, -1.36 + max(i0 - 1.0, 0.0) * 0.34, re);
  float f2 = frondH(v, -1.36 + min(i0 + 1.0, 8.0) * 0.34, re);
  float crown = dome(length(v * vec2(1.0, 1.3)) - 0.045, 0.0095, 0.03, re);
  // date clusters hanging under the crown on either side
  vec2 dq = vec2(abs(v.x) - 0.07, v.y + 0.08);
  float dcl = sdEll(dq, vec2(0.034, 0.05));
  vec2 dc = fract(dq / 0.016) - 0.5;
  float dates = dome(dcl, 0.0072, 0.02, re) + 0.0012 * (1.0 - dot(dc, dc) * 3.0) * step(dcl, 0.0);
  return max(max(trunk, crown), max(max(f0, max(f1, f2)), dates));
}

// ---------------------------------------------------------------- the keruv
// One wing: its bone (the leading edge, marginal coverts) a gently bending curve from the shoulder blade S in the
// direction d0, bending by g toward the trailing side over its length L; the feathers trail on one side of it
// (side = +1/-1), up to Wm wide: two rows of rounded coverts over long flight feathers that overlap like shingles,
// leaning toward the tip as they go out, their rounded tips scalloping the trailing edge.
float wingH(vec2 q, vec2 S, vec2 d0, float g, float L, float Wm, float H, float re, float fw, float side) {
  vec2 v = q - S;
  vec2 dir = normalize(d0);
  vec2 nrm = vec2(-dir.y, dir.x) * side;           // toward the trailing side
  float u = clamp(dot(v, dir), 0.0, L);
  vec2 P = dir * u + nrm * g * u * u;
  vec2 T = normalize(dir + nrm * 2.0 * g * u);
  u = clamp(u + dot(v - P, T), 0.0, L);
  P = dir * u + nrm * g * u * u;
  T = normalize(dir + nrm * 2.0 * g * u);
  vec2 N = vec2(-T.y, T.x) * side;
  float across = dot(v - P, N);                      // > 0 on the feather side
  float along = dot(v - P, T);                       // beyond the ends
  float tt = u / L;
  float W = Wm * mix(0.45, 1.0, smoothstep(0.0, 0.35, tt)) * mix(1.0, 0.2, smoothstep(0.5, 1.0, tt));
  float s = across / W;
  float slant = mix(0.55, 1.4, smoothstep(0.2, 1.0, tt));
  float phi = u + slant * across;                    // across the feathers (m)
  float fa = fract(phi / fw);
  float tipB = 0.1 * (1.0 - pow(2.0 * fa - 1.0, 2.0));
  float dIn = -across - 0.012;                       // the bone's own rounded thickness
  float dOut = across - W * (1.0 + tipB);
  float dEnd = u >= L - 1e-4 ? along + slant * max(across, 0.0) - 0.06 : (u + slant * max(across, 0.0)) - (L + 0.06);
  float dRoot = u <= 1e-4 ? -along : -1.0;
  float d = max(max(dIn, dOut), max(dEnd, dRoot));
  float e = smoothstep(0.0, re, -d);
  float bone = 1.0 - smoothstep(-0.05, 0.14, s);
  float rowC = (s - 0.1) / 0.17;
  float jr = floor(rowC);
  float sr = fract(rowC);
  float ca = fract(phi / (fw * 0.8) + 0.5 * jr);
  float covE = sr + 0.32 * pow(2.0 * ca - 1.0, 2.0);
  float cov = step(0.0, rowC) * step(rowC, 2.0) * (1.0 - smoothstep(0.66, 0.9, covE));
  float covStep = step(0.0, rowC) * step(rowC, 2.0) * smoothstep(0.55, 0.9, covE);
  float flight = smoothstep(0.43, 0.5, s);
  float vault = 1.0 - pow(2.0 * fa - 1.0, 2.0);
  float shaft = groove(fa - 0.5, 0.05) * flight * smoothstep(0.5, 0.7, s);
  float level = mix(1.0, 0.5, smoothstep(0.1, 1.0, s)) * mix(1.0, 0.75, tt);
  float hh = H * level + H * 0.22 * bone
           + (1.0 - flight) * (0.0012 * cov - 0.0007 * covStep)
           + flight * (0.0009 * fa + 0.0007 * vault - 0.0005 * groove(fa, 0.04) + 0.0004 * shaft);
  return e * hh;
}

float keruvH(vec2 q, float re, float rf, out float skin) {
  // ---- head: a child's head in profile facing +x — the cranium a little smaller than the old ball, the face
  // fuller and further forward (cheek, forehead, jaw), small features modelled on their own (rf: finer rounding)
  float dCr = length(q - vec2(-0.02, 0.975)) - 0.1;
  float dBrow = sdEll(q - vec2(0.05, 1.0), vec2(0.055, 0.05));
  float dCheek = sdEll(q - vec2(0.045, 0.915), vec2(0.068, 0.062));
  float dChin = sdEll(q - vec2(0.058, 0.868), vec2(0.034, 0.027));
  float dSkull = smin(smin(smin(dCr, dBrow, 0.03), dCheek, 0.035), dChin, 0.02);
  float dNose = sdEll(rot2(q - vec2(0.102, 0.94), 0.35), vec2(0.019, 0.012));
  float dLipU = sdEll(q - vec2(0.093, 0.907), vec2(0.011, 0.0074));
  float dLipL = sdEll(q - vec2(0.087, 0.893), vec2(0.0098, 0.0072));
  // the nose and lips grow out of the face (smooth unions), so the profile is one modelled form, not stuck-on parts
  float dHead = smin(dSkull, dNose, 0.016);
  dHead = smin(dHead, min(dLipU, dLipL), 0.009);
  float dHeadAll = dHead;
  float hHead = dome(dHead, 0.0205, 0.075, rf * 1.6);
  float hFeat = 0.0016 * smoothstep(0.004, -0.008, dNose) + 0.0008 * smoothstep(0.003, -0.004, min(dLipU, dLipL));
  // cap of short curls over the top and back of the skull: raised above the skin, its outline bumpy with curls
  vec4 cv = vL(q, vec2(0.017), vec2(0.37, 0.61));
  float curlD = cv.x;
  float curl = (1.0 - smoothstep(0.15, 0.55, curlD)) * smoothstep(0.0, 0.12, cv.y + 0.05) * (0.7 + 0.3 * sin(cv.z * 40.0 + curlD * 18.0));
  float hairLine = (q.x - 0.045) + 0.75 * (q.y - 1.035);       // the hairline: forehead top to behind the ear
  float dHair = max(dCr - 0.006 - 0.004 * curl, hairLine);
  dHair = max(dHair, -(sdEll(q - vec2(-0.002, 0.915), vec2(0.026, 0.034))));   // the ear stays clear
  float hHair = dome(dHair, 0.0225, 0.07, rf) + 0.0022 * curl * smoothstep(0.0, 0.008, -dHair);
  // face details: brow ridge, almond eye under its lid, a soft ear, the line of the mouth, cheek fullness
  vec2 eq = rot2(q - vec2(0.074, 0.953), 0.1);
  float dEye = sdEll(eq, vec2(0.017, 0.0078));
  float socket = -0.0012 * smoothstep(0.012, -0.004, sdEll(eq - vec2(-0.004, 0.001), vec2(0.028, 0.016)));
  float eye = socket + 0.0016 * smoothstep(0.002, -0.004, dEye) - 0.0009 * groove(dEye, 0.0018);
  float lid = 0.0005 * groove(sdEll(eq - vec2(-0.002, 0.004), vec2(0.019, 0.0095)), 0.002) * step(0.0, eq.y);
  float brow = 0.0011 * smoothstep(0.006, -0.004, sdEll(rot2(q - vec2(0.078, 0.973), -0.2), vec2(0.026, 0.006)));
  vec2 aq = q - vec2(-0.006, 0.917);
  float dEar = sdEll(aq, vec2(0.016, 0.024));
  float ear = 0.0018 * smoothstep(0.004, -0.004, dEar) - 0.0011 * smoothstep(0.003, -0.003, sdEll(aq - vec2(0.004, 0.001), vec2(0.008, 0.014)));
  float mouth = 0.0007 * groove(q.y - 0.9 + 0.3 * (q.x - 0.1), 0.0016) * step(0.084, q.x) * step(q.x, 0.108);
  float cheek = 0.0024 * smoothstep(0.02, -0.03, sdEll(q - vec2(0.05, 0.905), vec2(0.035, 0.03)));
  float inHead = step(dHeadAll, 0.0);
  float headH = max(hHead + (cheek + brow + eye + lid + ear - mouth + hFeat) * inHead, hHair);
  // ---- neck, chubby torso and the short belted tunic (sleeves to mid upper arm, hem above the knee, flaring)
  float dNeck = sdLimb(q, vec2(-0.012, 0.79), vec2(0.008, 0.865), 0.045, 0.042);
  float dChest = sdEll(q - vec2(-0.008, 0.665), vec2(0.108, 0.13));
  float dBelly = sdEll(q - vec2(0.03, 0.6), vec2(0.085, 0.085));
  float hemY = 0.4 + 0.009 * sin(q.x * 40.0 + 0.6);
  float sw = mix(0.132, 0.108, clamp((q.y - 0.4) / 0.2, 0.0, 1.0));
  float dSkirt = max(abs(q.x + 0.006) - sw, max(hemY - q.y, q.y - 0.62));
  float dBody = smin(smin(dChest, dBelly, 0.04), dSkirt, 0.04);
  dBody = smin(dBody, dNeck, 0.03);
  float hBody = dome(dBody, 0.019, 0.095, re);
  // drapery: a few soft folds falling from the belt and fanning toward the hem, two diagonal folds over the chest
  float skirt = smoothstep(0.0, 0.012, -dSkirt) * step(q.y, 0.585);
  float yy = clamp((0.585 - q.y) / 0.185, 0.0, 1.0);
  float fx = (q.x + 0.006) / mix(0.04, 0.062, yy) + 0.35 * sin(q.y * 17.0 + q.x * 9.0);
  float folds = pow(0.5 + 0.5 * cos(fx * TAU), 1.6);
  float chestF = groove(fract((q.x * 0.8 + (q.y - 0.7)) / 0.06) - 0.5, 0.18) * smoothstep(0.62, 0.66, q.y) * (1.0 - smoothstep(0.73, 0.78, q.y));
  float belt = smoothstep(0.0, 0.006, 0.011 - abs(q.y - 0.588 + 0.05 * q.x)) * step(dBody, 0.0);
  float hemL = groove(q.y - hemY, 0.004) * step(abs(q.x + 0.006), sw);
  float neckline = groove(sdEll(q - vec2(0.004, 0.795), vec2(0.052, 0.022)), 0.003) * step(q.y, 0.8);
  float bodyH = hBody + skirt * (0.0026 * folds * (0.35 + 0.65 * yy)) + 0.0008 * chestF * step(dBody, 0.0)
              + 0.0016 * belt - 0.0008 * hemL - 0.0005 * neckline;
  // ---- legs below the hem: plump knees and calves, ankles, feet; the far leg a step behind and lower
  float dThN = sdLimb(q, vec2(0.03, 0.47), vec2(0.052, 0.31), 0.058, 0.046);
  float dShN = sdLimb(q, vec2(0.052, 0.31), vec2(0.04, 0.095), 0.046, 0.031);
  float dCalfN = sdEll(q - vec2(0.038, 0.22), vec2(0.046, 0.064));
  float dFootN = sdEll(rot2(q - vec2(0.08, 0.055), 0.05), vec2(0.066, 0.031));
  float dLegN = smin(smin(smin(dThN, dShN, 0.025), dCalfN, 0.03), dFootN, 0.02);
  float knee = 0.0016 * smoothstep(0.01, -0.02, length(q - vec2(0.07, 0.315)) - 0.024);
  float legN = dome(dLegN, 0.0145, 0.045, re) + knee * step(dLegN, 0.0);
  float dThF = sdLimb(q, vec2(-0.032, 0.47), vec2(-0.034, 0.31), 0.054, 0.044);
  float dShF = sdLimb(q, vec2(-0.034, 0.31), vec2(-0.05, 0.095), 0.044, 0.029);
  float dCalfF = sdEll(q - vec2(-0.054, 0.215), vec2(0.042, 0.06));
  float dFootF = sdEll(rot2(q - vec2(-0.006, 0.05), 0.04), vec2(0.062, 0.028));
  float dLegF = smin(smin(smin(dThF, dShF, 0.025), dCalfF, 0.03), dFootF, 0.02);
  float legF = dome(dLegF, 0.0105, 0.04, re);
  float toes = 0.0004 * groove(fract((q.y - 0.03) / 0.011) - 0.5, 0.2) * step(0.125, q.x) * step(dFootN, 0.0);
  // ---- the near arm: upper arm forward and down (a short sleeve over it), forearm raised toward the palm, open hand
  float dUA = sdLimb(q, vec2(0.004, 0.752), vec2(0.08, 0.64), 0.04, 0.034);
  float dFA = sdLimb(q, vec2(0.08, 0.64), vec2(0.16, 0.706), 0.034, 0.026);
  float dHand = sdEll(rot2(q - vec2(0.19, 0.732), -0.65), vec2(0.032, 0.022));
  float dThumb = sdLimb(q, vec2(0.17, 0.72), vec2(0.19, 0.752), 0.009, 0.007);
  float dArm = smin(smin(smin(dUA, dFA, 0.025), dHand, 0.012), dThumb, 0.006);
  float sleeve = groove(dot(q - vec2(0.038, 0.702), normalize(vec2(0.076, -0.112))), 0.003) * step(dUA, 0.0);
  float elbow = 0.0012 * smoothstep(0.008, -0.012, length(q - vec2(0.08, 0.637)) - 0.02);
  vec2 hq = rot2(q - vec2(0.19, 0.732), -0.65);
  float fingers = 0.0005 * groove(fract(hq.y / 0.0095) - 0.5, 0.18) * step(dHand, 0.0) * step(0.004, hq.x);
  float armH = dome(dArm, 0.0235, 0.032, re * 0.8) + (0.002 + elbow - fingers - 0.0006 * sleeve) * step(dArm, 0.0);
  // ---- wings, from the shoulder blades: the near wing rises up and a little back, the far wing more upright behind
  // it (Shemot 25:20 "spreading their wings upward"); both trail their feathers backward
  float wN = wingH(q, vec2(-0.075, 0.74), vec2(-0.07, 1.0), 0.1, 0.84, 0.2, 0.0105, re, 0.04, 1.0);
  float wF = wingH(q, vec2(-0.04, 0.78), vec2(0.15, 1.0), 0.16, 0.8, 0.17, 0.007, re, 0.036, 1.0);
  // ---- compose back to front, with fine contour grooves where a part crosses the one behind
  float h = max(wF, wN - 0.0004 * groove(wF - wN, 0.0008));
  h = max(h, legF);
  float front = max(max(bodyH, legN), headH);
  h = max(h, front) - 0.0007 * groove(dBody, 0.003) * step(0.002, max(wN, legF));
  h -= 0.0007 * groove(dHeadAll, 0.003) * step(0.002, wN);
  h -= 0.0006 * groove(dLegN, 0.003) * step(dBody, 0.004);
  h = max(h, armH) - 0.0008 * groove(dArm, 0.0035) * step(0.004, max(bodyH, wN));
  h += toes;
  skin = step(min(min(dHead, dArm), dLegN), 0.0) * step(0.0, dHair);
  return h;
}

void surf(vec2 p, inout S s) {
  vec4 dv = vT(p, vec2(0.022), vec2(0.0));
  float burn = nT(p, vec2(6.0, 30.0), vec2(0.3, 0.3)).y;
  float W = uP0.z;
  float bandH = uP0.y;
  float H = uTile.y;
  float fieldH = H - 2.0 * bandH;
  float fy = p.y - bandH;
  float tex = max(uTile.x / uRes.x, uTile.y / uRes.y);
  float re = max(0.008, tex * 3.0);
  float rf = max(0.004, tex * 1.5);
  float xp = p.x - floor(p.x / W + 0.5) * W;
  // a pair of keruvim faces each palm, one on either side (their faces toward the tree, Shemot 25:20 "their faces
  // one to another"); between two palms the two keruvim stand back to back
  float xk = 0.5 - abs(xp);
  float xr = p.x - (floor(p.x / (W * 0.25)) + 0.5) * W * 0.25;
  float yc = fy < 0.0 ? bandH * 0.5 : H - bandH * 0.5;
  float inField = step(0.0, fy) * step(fy, fieldH);
  float skin;
  float fig = max(palmH(vec2(xp, fy), re), keruvH(vec2(xk, fy - 0.04), re, rf, skin));
  float ros = rosette(vec2(xr, p.y - yc), bandH * 0.36, re);
  float h = mix(ros, fig, inField);
  float bd = min(abs(p.y - bandH), abs(p.y - (H - bandH)));
  float bead = 0.007 * sqrt(max(0.0, 1.0 - pow(bd / 0.014, 2.0)));
  h = max(h, bead);
  // sheet seams on the palm axis and midway between the back-to-back keruvim, hidden where they cross relief
  float sx = abs(p.x - floor(p.x / (W * 0.5) + 0.5) * W * 0.5);
  float seamV = 1.0 - smoothstep(uP0.w * 0.5, uP0.w * 1.5, sx);
  float seamH = 1.0 - smoothstep(uP0.w * 0.5, uP0.w * 1.5, min(min(abs(bd - 0.02), p.y), H - p.y));
  float seam = max(seamV, seamH) * (1.0 - smoothstep(0.0008, 0.003, h));
  float dish = uP1.z * (dv.x * dv.x - 0.3) * (1.0 - smoothstep(0.0005, 0.003, h));
  s.h = h + dish - seam * 0.0006;
  float raised = smoothstep(0.001, 0.012, h);
  vec3 col = vec3(0.925 + 0.06 * raised + 0.012 * burn) * vec3(1.0, 0.988, 0.965);
  s.alb = mix(col, col * 0.45, seam);
  s.rough = mix(uP1.y, uP1.x, raised) + 0.03 * burn - 0.03 * skin * raised + uP1.w * (dv.z - 0.5) * 2.0 * (1.0 - 0.5 * raised);
  // gate-world-materials: the crests of the forms (heads, chests, wing bones, palm trunks, rosette hearts) burnished by
  // the fitting and by hands — the gold there smoother (−0.09), so the relief's edges and highs catch the gate's light
  // as sharper highlights against the duller hammered ground
  s.rough -= 0.09 * smoothstep(0.006, 0.018, h);
  s.rough = mix(s.rough, 0.6, seam);
  s.metal = mix(1.0, 0.5, seam);
}`,
  },
};

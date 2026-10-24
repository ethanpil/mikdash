// Fire kinds. Geometry is relative to spec.size (metres, "rough flame size"); per-tier arrays are
// [low, medium, high, ultra].
//
// FLAMES (qa-r1-fix-env-render): a few soft-edged camera-facing cards per fire, each a procedural flipbook (rising,
// domain-warped noise eroding a plume envelope: the licks come from the noise, not from separate sprites):
//   cards   per tier; card 0 stands over the fuel's centre and is the widest and tallest, the others on a ring of
//           ringR × size round it. cardW / cardH: [outer, central] width / height ÷ size.
//   core    the hot core's added emission (× L at its peak): an additive layer over the alpha-blended flame body.
//
// PHOTOMETRY (physical; multiplied by env.preExposure like every env light — see src/env/index.js):
//   L       flame luminance scale, cd/m² (body ≈ 0.3–0.6 L, a card's hot core up to ≈ 1 L + core × 0.88 L, tips less).
//           Sooty wood/oil flames are ~1e4–3e4 cd/m² in their bright yellow region (a candle ≈ 1e4); soot at 1600 K is
//           ≈ 2e4 cd/m² as a black body, at 1700 K ≈ 5e4 — the core is brighter than sunlit white stone (≈ 1–2e4).
//   light   luminous intensity, cd ≈ projected flame area × mean luminance, scaled by (size/refSize)²;
//           inverse square from `height`·size above the base (the flames' centre: the hearth's and brazier's higher, so
//           their low logs do not throw spokes of shadow across the floor), softened within the flames' own radius
//           (render/fx/lights.js FLAME_R: 1 / (d² + r²), no point-light hot spot beside the fire).
//   charR / ash  (hearths) the coal-bed decal's char reach ÷ its radius, and how far it greys the floor there (0..1)
//   Lember / Lbed  glowing sparks / the coal bed's hottest seams, cd/m² (≈ 1350–1450 K: 1.5e3–5e3 as a black body;
//           the decal's seams average far less).
//   light colour: ~1900 K firelight partly white-balanced (the eye adapts chromatically to firelight;
//           the flames themselves keep their full colour in the shader ramp).
//   halo    glare sprite: radius / size and centre luminance as a fraction of L (bloom covers it on
//           post tiers; the low tier has no bloom, so the halo carries the glow there). Kept small
//           (≤ 0.6 × size for the big fires) and purely exponential: a large aura around the altar fire would
//           read as the supernatural glow the Second Temple did NOT have (Part VIII §32; Yoma 21b).
//
// RESEARCH (report Part VIII §31–§32; Yoma 21b; Avot 5:5; Yoma 38a; Tamid 1:1, 1:3, 2:3; Middot 1:2, 1:9):
//  * pyre: the Second-Temple altar fire is an ORDINARY large wood fire needing constant fuelling — the heavenly
//    fire "crouched like a dog" and did not assist; NO supernatural glow, colour or smokelessness (smokeless /
//    sun-clear are FIRST-Temple properties, Yoma 21b). Woods: fig, walnut, oil-tree (Tamid 2:3) => normal
//    orange wood flame and grey wood smoke.
//  * its smoke column is never bent by wind (Avot 5:5) => rises straight up.
//  * incense (ketoret) smoke "rises straight like a stick" (Yoma 38a, "mitamer ve'oleh ke-makel").
//  * hearth = the Beit HaMoked medurah (Tamid 1:1; Middot 1:9); torch = the avukot of the inspection
//    companies and the Ish Har HaBayit (Tamid 1:3; Middot 1:2); lamp = small oil-lamp flame (menorah lamps,
//    the lamps lining the passage under the Birah — Tamid 1:1).
export const KINDS = {
  pyre: {
    refSize: 2.0,
    cards: [3, 4, 4, 4],
    spread: 0.42,            // footprint radius / size
    bed: 1.35,               // coal-bed radius / footprint radius
    bedH: 0.42,              // coal-bed decal's height (the logs it chars and lights) / size
    ringR: 0.3,              // outer cards' ring radius / size
    cardH: [0.95, 1.3],      // card height / size [outer, central]
    cardW: [0.62, 0.95],     // card width / size
    core: 1.5,
    turb: 1.0, speed: 1.0,
    L: 2.0e4, Lember: 8e3, Lbed: 4e3,
    embers: [20, 40, 64, 90],
    emberRise: 2.4, emberRate: [0.35, 0.7], emberSize: 0.012,
    halo: { radius: 0.6, frac: 0.03 },
    light: { candela: 1.5e4, distance: 70, color: 0xff9d55, flicker: 0.12, height: 0.6 },
    smoke: { height: 46, width: 0.75, density: 0.38, rise: 2.4, spread: 4.2, kind: 0 },
  },
  hearth: {
    refSize: 0.8,
    cards: [3, 3, 4, 4],
    spread: 0.38, bed: 1.4, bedH: 0.5, ringR: 0.22, cardH: [1.05, 1.45], cardW: [0.75, 1.05], core: 1.5,
    // qa-r2-fix-env-render: the decal reaches 2.8 × the bed's radius: the logs charred along their length, the floor round
    // the kerb greyed by ash and soot to (1 − ash) of its albedo ⚙ (a hearth burning day and night, Tamid 1:1)
    charR: 2.8, ash: 0.5,
    turb: 0.95, speed: 1.05,
    L: 2.0e4, Lember: 8e3, Lbed: 4e3,
    embers: [10, 18, 26, 34],
    emberRise: 2.2, emberRate: [0.5, 0.9], emberSize: 0.012,
    halo: { radius: 0.6, frac: 0.03 },
    light: { candela: 2.5e3, distance: 30, color: 0xff9d58, flicker: 0.14, height: 0.85 },
    smoke: null,
  },
  brazier: {
    refSize: 0.6,
    cards: [2, 2, 3, 3],
    spread: 0.3, bed: 1.3, bedH: 0.45, ringR: 0.18, cardH: [0.95, 1.2], cardW: [0.7, 0.95], core: 1.5,
    turb: 0.9, speed: 1.1,
    L: 2.0e4, Lember: 8e3, Lbed: 4e3,
    embers: [6, 10, 16, 22],
    emberRise: 1.4, emberRate: [0.55, 1.0], emberSize: 0.011,
    halo: { radius: 0.6, frac: 0.03 },
    light: { candela: 1.2e3, distance: 24, color: 0xffa05a, flicker: 0.15, height: 0.8 },
    smoke: null,
  },
  torch: {
    refSize: 0.35,
    cards: [1, 2, 2, 2],
    spread: 0.1, ringR: 0.06, cardH: [1.0, 1.25], cardW: [0.5, 0.62], core: 1.4,
    turb: 0.85, speed: 1.3,
    L: 2.5e4, Lember: 8e3, Lbed: 0,
    embers: [0, 3, 5, 7],
    emberRise: 0.9, emberRate: [0.7, 1.2], emberSize: 0.008,
    halo: { radius: 1.2, frac: 0.04 },
    light: { candela: 300, distance: 18, color: 0xffa862, flicker: 0.18, height: 0.5 },
    smoke: { height: 1.8, width: 0.1, density: 0.22, rise: 1.0, spread: 2.5, kind: 0, minTier: 1 },
  },
  lamp: {
    refSize: 0.08,
    cards: [1, 1, 1, 1],
    spread: 0, ringR: 0, cardH: [1, 1], cardW: [0.42, 0.42], core: 1.2,
    turb: 0.22, speed: 0.75,
    L: 1.2e4, Lember: 0, Lbed: 0,
    embers: [0, 0, 0, 0],
    emberRise: 0, emberRate: [1, 1], emberSize: 0,
    halo: { radius: 0.5, frac: 0.05 },
    light: { candela: 3, distance: 6, color: 0xffb46e, flicker: 0.05, height: 0.6 },
    smoke: null,
  },
};
KINDS.menorah = KINDS.lamp; // alias used in core/context.js docs

export function kindPreset(kind) {
  return KINDS[kind] || KINDS.torch;
}

// Texture SETS: kind + physical tile (m) + resolution at the reference size 2048 (scaled by
// quality.textureSize / 2048, floored at minPx) + parameters. Colours are sRGB hex (converted to linear
// when uploaded). One set may serve several materials (e.g. the vessel metals, tinted by material.color).
// `rotOf: id` marks a grain-along-v view of another set: nothing is baked, the material swaps its UVs (patch.js).
//
// Research: report Part VII §21 (materials matrix), §23 (fabrics), §24 (metals), §26 (palette), Part V §13.11.
// Dimensions marked "recon." are reconstruction — see docs/decisions/materials*.md.

// Herodian coursing: 12 courses per tile in an irregular sequence of shayish (0), kochla (1) and marmara (2) — kochla
// every 3rd, 4th, 5th course, never a strict period (materials-2-fix: a strict white/kochla/marmara cycle read as
// pinstripes from 50 m) — one course set out and one drawn in (even rows set out, as the builders model them).
const HERODIAN_SEQ = [0, 2, 1, 0, 2, 1, 0, 0, 2, 1, 0, 2];
const herodianRows = (r) => [HERODIAN_SEQ[r % 12], r % 2 === 0 ? 1 : 0];
// the course-table variant (herodian_wall_courses): course heights 1.00–1.20 m in whole cm, summing to 13.2 m (recon.)
export const HERODIAN_COURSES = [1.12, 1.04, 1.18, 1.08, 1.0, 1.15, 1.2, 1.06, 1.1, 1.02, 1.16, 1.09];

// Kochla (blue-green banded marble): ONE palette for the wall courses and the monolithic marble_kochla — base, band
// (slightly deeper layers) and the sparse pale streaks. A pale grey with a hint of grey-green: its value ~0.3 stop
// under the white, its chroma half that of materials-2 and its residual cast green rather than blue (skylight before
// dawn amplified the blue into stripes).
const KOCHLA = { base: '#cbd0ca', band: '#bfc6c0', streak: '#dadcd7' };

const marbleWall = {
  // shayish (white) · kochla (blue-green) · marmara (veined) — Bava Batra 4a; Part VII §21 #1, §26
  uC0: '#e7e2d7', uC1: KOCHLA.base, uC2: '#dad5cb',
  uC3: '#cbc6bd', uC4: KOCHLA.streak, uC5: '#a39e96', uC6: KOCHLA.band,
};
const herodianU = {
  // uP0 margin 11 cm (8.3–13.8 per side), boss raise 15 mm (11–19), joint 1 mm, set-out 4 cm;
  // uP1 boss pit depth 2.2 mm; uP3 bevel 4 cm (3.2–5), tone ±4.5 %, hue cast 0.6, vein slant ±0.45 rad
  uP0: [0.11, 0.015, 0.001, 0.04], uP1: [1, 0.0022, 0.6, 1], uP2: [0.004, 0.004, 0.05, 0.35], uP3: [0.04, 0.045, 0.6, 0.9], ...marbleWall,
};
const herodianInnerU = { ...herodianU, uP0: [0.11, 0.0, 0.001, 0.04], uP1: [0, 0, 0.4, 1], uP2: [0.005, 0.003, 0.05, 0.3] };

// firewood pile (Tamid 2:3): fig (smooth warm grey), walnut (dark grey-brown, furrowed), oil-tree read as
// Aleppo pine (grey-brown plate faces over red-brown fissures); split wood (pale)
const barkPalette = { uC0: '#6c665a', uC1: '#4f453c', uC2: '#3f2a20', uC3: '#6b5f52', uC4: '#a08a6c' };

const wood = (rings, warp, pores, knots, rough, weather, rays, figure, c0, c1, c2) => ({
  uP0: [rings, warp, pores, knots], uP1: [rough, weather, rays, figure], uC0: c0, uC1: c1, uC2: c2,
});

export const SETS = {
  // ---------------- stone ----------------
  herodian: {
    kind: 'herodian', tile: [13, 13.2], px: [1664, 1690], seed: 11,
    // (1664 px: 7.8 mm/texel on high — the boss's pits on 2.2–3.4 cm cells stay >= 3 texels)
    // courses 1.1 m, blocks 2–5 m (recon.); dry hairline joints (1 mm half-width, 4 mm deep, 4 mm rounded arris)
    layout: { rowH: 1.1, q: 0.5, minL: 2.0, maxL: 5.0, gap: 0.75, rowType: herodianRows },
    u: herodianU,
  },
  herodian_inner: {
    kind: 'herodian', tile: [13, 13.2], px: [896, 910], seed: 11,
    layout: { rowH: 1.1, q: 0.5, minL: 2.0, maxL: 5.0, gap: 0.75, rowType: herodianRows },
    u: herodianInnerU,
  },
  // course-table variants (1.00–1.20 m courses): for builders that model their set-out courses from
  // ctx.mats.courseAt(key, y) (see index.js)
  herodian_c: {
    kind: 'herodian', tile: [13, 13.2], px: [1664, 1690], seed: 13,
    layout: { rowH: 1.1, q: 0.5, minL: 2.0, maxL: 5.0, gap: 0.75, rowType: herodianRows, heights: HERODIAN_COURSES },
    u: herodianU,
  },
  herodian_inner_c: {
    kind: 'herodian', tile: [13, 13.2], px: [896, 910], seed: 13,
    layout: { rowH: 1.1, q: 0.5, minL: 2.0, maxL: 5.0, gap: 0.75, rowType: herodianRows, heights: HERODIAN_COURSES },
    u: herodianInnerU,
  },
  // dressed limestone: hairline joints (fill only a little darker than the stone), small cavity radius so the joints
  // do not get dark halos (materials-2: the old dark joint read as modern tiling)
  ashlar: {
    kind: 'ashlar', tile: [9, 4.8], px: [832, 444], seed: 23, ao: [0.012, 0.008, 0.4],
    layout: { rowH: 0.96, q: 0.5, minL: 1.0, maxL: 3.0, gap: 0.5 },
    u: { uP0: [0.0015, 0.004, 0.0008, 0.008], uC0: '#dccfb6', uC1: '#d3c5a9', uC2: '#cdc0a4', uC3: '#ab9f88' },
  },
  // the Heichal's annual lime wash (Middot 3:4) over large dressed ashlar: joints softened and mostly filled,
  // tooling muted, faint horizontal brush/cloth strokes; courses 1.1 m, blocks 1.5–4 m (recon.)
  ashlar_wash: {
    kind: 'ashlar', tile: [10, 4.4], px: [896, 396], seed: 29,
    layout: { rowH: 1.1, q: 0.5, minL: 1.5, maxL: 4.0, gap: 0.6 },
    u: {
      uP0: [0.0015, 0.004, 0.0007, 0.006], uP1: [1, 0.0007, 0.8, 0],
      uC0: '#dccfb6', uC1: '#d3c5a9', uC2: '#cbbd9f', uC3: '#a69c8a', uC4: '#f0ede5',
    },
  },
  paving_mount: {
    kind: 'paving', tile: [10, 10], px: [832, 832], seed: 31,
    layout: { rowH: 1.25, q: 0.5, minL: 1.0, maxL: 2.5, gap: 0.5 },
    u: {
      uP0: [0.002, 0.008, 0.016, 0.6], uP1: [1, 0.72, 0.004, 0.004], uP2: [0.3, 0.1, 0.14, 0.3],
      uC0: '#d4cab5', uC1: '#c2b7a0', uC2: '#d8d3c6', uC3: '#aaa395', uC4: '#a39d92',
    },
  },
  paving_azarah: {
    kind: 'paving', tile: [10, 9.6], px: [832, 800], seed: 37,
    layout: { rowH: 1.6, q: 0.5, minL: 1.5, maxL: 3.5, gap: 0.5 },
    u: {
      uP0: [0.0012, 0.006, 0.006, 0.15], uP1: [1, 0.36, 0.0015, 0.001], uP2: [0.85, 0.06, 0.04, 0.85],
      uC0: '#e8e3d8', uC1: '#ded6c5', uC2: '#d4d1c8', uC3: '#bdb4a6', uC4: '#a29d95',
    },
  },
  steps: {
    kind: 'stone', tile: [3, 3], px: [448, 448], seed: 41,
    u: { uP0: [0.0006, 0.5, 0.6, 0.08], uC0: '#d8cdb7', uC1: '#d2c5ab' },
  },
  marble_white: {
    kind: 'marble', tile: [3, 3], px: [448, 448], seed: 43,
    u: { uP0: [0, 0.6, 0.3, 0.06], uC0: '#ece8df', uC1: '#b5b0a8', uC2: '#ece8df' },
  },
  marble_kochla: {
    kind: 'marble', tile: [3, 3], px: [448, 448], seed: 47,
    u: { uP0: [1, 0.6, 0.34, 0.05], uC0: KOCHLA.base, uC1: KOCHLA.streak, uC2: KOCHLA.band },
  },
  marble_veined: {
    kind: 'marble', tile: [3, 3], px: [448, 448], seed: 53,
    u: { uP0: [2, 0.6, 0.28, 0.06], uC0: '#e2dcd0', uC1: '#a39e96', uC2: '#e2dcd0' },
  },
  plaster: {
    kind: 'plaster', tile: [4, 4], px: [576, 576], seed: 59,
    u: { uP0: [0.0008, 0.00012, 0.4, 0], uP1: [0.3, 0.86, 0, 0], uC0: '#ebe5d7', uC1: '#dad1be', uC2: '#bfb5a2' },
  },
  // ma'azivah: the plaster/lime-concrete roof fill (Middot 4:6) — no roof tiles are attested
  roof: {
    kind: 'plaster', tile: [6, 6], px: [512, 512], seed: 61,
    u: { uP0: [0.0006, 0.0002, 0.6, 0.5], uP1: [0.55, 0.9, 0, 0], uC0: '#d2c9b6', uC1: '#aaa292', uC2: '#9d968a' },
  },
  // closely packed rounded stones ~25 / ~11 cm with warped outlines (4 cm), low pillows (9 / 4 mm) buried in broad
  // lime fillets, so they read as soft bulges under thick renewed lime; faint horizontal cloth-wipe strokes
  whitewash: {
    kind: 'whitewash', tile: [4, 4], px: [704, 704], seed: 67,
    u: { uP0: [0.009, 0.004, 0.002, 0.0003], uP1: [0, 0.9, 0.04, 0.6], uC0: '#f3f1ea', uC1: '#c6c1b6', uC2: '#8e2b1c' },
  },
  // same skin (same seed/tile) so the painted girdle continues the whitewashed stones exactly
  sikra: {
    kind: 'whitewash', tile: [4, 4], px: [512, 512], seed: 67,
    u: { uP0: [0.009, 0.004, 0.002, 0.0003], uP1: [1, 0.86, 0.04, 0.6], uC0: '#f3f1ea', uC1: '#c6c1b6', uC2: '#8f2a1b' },
  },
  // the Even Shetiyah (world-4): pale Jerusalem limestone beside the Kodesh HaKodashim's gold, so lighter stone, fewer
  // and shallower crevices, little patina or soil (it stands indoors) and a weaker baked cavity AO (0.55 -> 0.3)
  bedrock: {
    kind: 'rock', tile: [4, 4], px: [576, 576], seed: 71, ao: [0.12, 0.03, 0.3],
    u: { uP0: [0.04, 0.35, 0.35, 0.0], uP1: [0.05, 0.06, 0.88, 0], uC0: '#d9cdb2', uC1: '#cec2a6', uC2: '#aba294', uC3: '#8a6a52' },
  },
  terrain_rock: {
    kind: 'rock', tile: [8, 8], px: [576, 576], seed: 73,
    u: { uP0: [0.08, 0.9, 0.7, 0.6], uP1: [0.55, 0.6, 0.9, 0], uC0: '#b7af9f', uC1: '#a8a090', uC2: '#7d7a72', uC3: '#7f5640' },
  },
  terrain_soil: {
    kind: 'soil', tile: [4, 4], px: [640, 640], seed: 79,
    u: { uP0: [0.005, 0.07, 0.4, 0.012], uP1: [0, 0, 0, 0.012], uC0: '#745f4f', uC1: '#614f41', uC2: '#bdb3a0', uC3: '#8c7b69' },
  },
  ash: {
    kind: 'ash', tile: [2, 2], px: [512, 512], seed: 83,
    u: { uP0: [0.004, 0.045, 0.35, 0.1], uC0: '#bdb8b0', uC1: '#a29d95', uC2: '#35302b', uC3: '#4e3a2a' },
  },

  // ---------------- metal ----------------
  goldplate: {
    kind: 'goldplate', tile: [5.76, 2.88], px: [896, 448], seed: 89, metal: true, hRange: 0.005,
    // sheets 1 amah high, 1.5–3 amot long (recon.); hammer dishes 1 mm deep on ~2.5 cm cells, the sheet
    // undulating ±1–2 mm over 20–40 cm; sheets matched closely (rough ±0.005, tone ±0.008)
    layout: { rowH: 0.48, q: 0.24, minL: 0.72, maxL: 1.44, gap: 0.24 },
    u: { uP0: [0.0008, 0.0004, 0.001, 0.025], uP1: [0.3, 0.005, 0.002, 1], uP2: [0.008, 0, 0, 0] },
  },
  // the Kodesh relief (materials-2-fix: relief heights in metres inside the kind, up to ~2.3 cm at the head)
  relief: {
    kind: 'relief', tile: [3.84, 2.88], px: [1088, 816], seed: 97, metal: true,
    u: { uP0: [0, 0.48, 1.92, 0.0012], uP1: [0.2, 0.34, 0.00008, 0] },
  },
  vessel: {
    kind: 'metal', tile: [0.5, 0.5], px: [384, 384], seed: 101, metal: true,
    u: { uP0: [0.00012, 0.014, 0.000015, 0.16], uP1: [0.12, 0.08, 0, 0.04], uC0: '#ffffff', uC1: '#e8dfcf', uC2: '#000000' },
  },
  // Nikanor's doors: polished cast Corinthian bronze (2 m tile: the waviness noise has one period per tile) —
  // casting/planishing waviness ~0.8 mm over 10–50 cm,
  // polishing streaks (rough ±0.07), a darker patina kept in the low spots; base roughness 0.27 (warm sheen)
  bronze: {
    kind: 'metal', tile: [2, 2], px: [512, 512], seed: 103, metal: true, hRange: 0.003,
    u: {
      uP0: [0.00025, 0.03, 0.00002, 0.27], uP1: [0.18, 0.08, 0, 0.04], uP2: [0.0008, 2.0, 0.07, 0.6],
      uC0: '#ffffff', uC1: '#c9ab84', uC2: '#000000',
    },
  },
  copper: {
    kind: 'metal', tile: [0.5, 0.5], px: [384, 384], seed: 107, metal: true,
    u: { uP0: [0.00018, 0.012, 0.00002, 0.25], uP1: [0.28, 0.1, 0.03, 0.05], uP2: [0.0002, 3.0, 0.03, 0.2], uP3: [0, 0.55, 0, 0], uC0: '#ffffff', uC1: '#b38269', uC2: '#668f7f' },
  },
  iron: {
    kind: 'iron', tile: [1, 1], px: [384, 384], seed: 109, metal: true,
    u: { uP0: [0.0006, 0.35, 0.6, 1.0], uC0: '#3a3836', uC1: '#7a4528', uC2: '#4a2a1a' },
  },

  // ---------------- wood (grain along u; *_v views swap UVs) ----------------
  cedar: { kind: 'wood', tile: [2, 0.5], px: [768, 192], seed: 113, u: wood(60, 0.35, 0.5, 0.08, 0.62, 0, 0, 0, '#8e6755', '#6a4a3b', '#5c3f32') },
  oak: { kind: 'wood', tile: [2, 0.5], px: [768, 192], seed: 127, u: wood(40, 0.45, 1.0, 0.06, 0.64, 0, 0.8, 0, '#9a7a55', '#6c5136', '#5a4430') },
  olive: { kind: 'wood', tile: [2, 0.5], px: [768, 192], seed: 131, u: wood(70, 0.6, 0.3, 0.05, 0.5, 0, 0, 0.8, '#b59a6a', '#8f764e', '#4f3d2a') },
  lattice_wood: { kind: 'wood', tile: [2, 0.5], px: [768, 192], seed: 137, u: wood(45, 0.4, 0.6, 0.04, 0.8, 0.7, 0, 0, '#94805f', '#6f5d45', '#7a6e60') },
  // altar firewood: fig, walnut, oil-tree (pine) logs (Tamid 2:3); rows = logs ~12–16 cm (recon.), 15 % split
  logs: {
    kind: 'logs', tile: [2.4, 0.96], px: [768, 307], seed: 139,
    layout: { rowH: 0.16, q: 0.12, minL: 0.48, maxL: 1.08, gap: 0.12 },
    u: { uP0: [0, 0.15, 0, 0], ...barkPalette },
  },
  // bark, one species per set (materials-2-fix): builders pick a key per log; timber_rough uses walnut
  bark_fig: {
    kind: 'bark', tile: [1.2, 0.48], px: [448, 180], seed: 141, minPx: 96,
    u: { uP0: [0, 0.0012, 0, 0.15], uC0: '#8a857a', uC1: '#5e584f', uC2: '#5e584f', uC3: '#a9a397', uC4: '#8f9a7e' },
  },
  bark_walnut: {
    kind: 'bark', tile: [1.2, 0.48], px: [448, 180], seed: 145, minPx: 96,
    u: { uP0: [1, 0.007, 0, 0.1], uC0: '#6f685e', uC1: '#3a3029', uC2: '#3a3029', uC3: '#7d766b', uC4: '#8a9278' },
  },
  bark_pine: {
    kind: 'bark', tile: [1.2, 0.48], px: [448, 180], seed: 147, minPx: 96,
    u: { uP0: [2, 0.008, 0, 0.05], uC0: '#6e6458', uC1: '#3e2c22', uC2: '#6e3a28', uC3: '#8a7d6c', uC4: '#8a9278' },
  },
  // old olive trunks: grey, twisted fissures at a slant (recon.)
  bark_olive: {
    kind: 'bark', tile: [1.2, 1.2], px: [384, 384], seed: 153, minPx: 128,
    u: { uP0: [3, 0.006, 0.35, 0.3], uC0: '#7c786e', uC1: '#47433c', uC2: '#47433c', uC3: '#8e897e', uC4: '#9aa086' },
  },
  // the pile's end faces: one log end per block (rows 16 cm, 16–20 cm wide), rings 3–6 mm, bark rim ~1 cm
  logend: {
    kind: 'logend', tile: [0.96, 0.96], px: [448, 448], seed: 143, minPx: 256,
    layout: { rowH: 0.16, q: 0.04, minL: 0.16, maxL: 0.2, gap: 0.06 },
    u: { uP0: [0.0045, 0.01, 0.8, 0.04], uC0: '#968e7c', uC1: '#5a4738', uC2: '#a08a6a', uC3: '#463d35', uC4: '#8d7d66' },
  },
  lattice: {
    kind: 'lattice', tile: [0.96, 0.96], px: [448, 448], seed: 149, minPx: 256,
    // spacing chosen so the diagonal pattern repeats exactly in the tile (4 slats per tile diagonal)
    u: { uP0: [0.96 / Math.SQRT2 / 4, 0.045, 0.02, 0], uC0: '#93806a', uC1: '#6f5e4b' },
  },

  // ---------------- materials-2 additions ----------------
  // timber_split: riven boards (the two gizrei etzim, Yoma 2:5) — fresh pale split wood, long torn ridges
  split_wood: {
    kind: 'wood', tile: [2, 0.5], px: [768, 192], seed: 293,
    u: { ...wood(55, 0.5, 0.4, 0.02, 0.8, 0, 0, 0, '#bb9f7f', '#9c7f63', '#8a735c'), uP2: [0.006, 0] },
  },
  // timber_weathered: sun-greyed oak of a working machine (the muchni), checks and raised grain
  weathered: {
    kind: 'wood', tile: [2, 0.5], px: [768, 192], seed: 307,
    u: { ...wood(40, 0.5, 0.9, 0.05, 0.86, 0.9, 0.5, 0, '#918877', '#6f675a', '#9d978a'), uP2: [0.0004, 0.0025] },
  },
  // fire-touched wood: alligator char (checks ~4 x 1.6 cm along the grain) and a coal bed under ash (glow in alpha)
  char: {
    kind: 'char', tile: [1, 1], px: [512, 512], seed: 257, minPx: 256,
    u: { uP0: [0, 0, 0, 0], uP1: [0.05, 0.018, 0.12, 0.006], uC0: '#0e0d0c', uC1: '#3c3933', uC2: '#8f8a83' },
  },
  embers: {
    kind: 'char', tile: [1, 1], px: [512, 512], seed: 263, minPx: 256,
    u: { uP0: [1, 0, 0, 0], uP1: [0.03, 0.02, 0.5, 0.004], uC0: '#141110', uC1: '#3b3835', uC2: '#aaa59d' },
  },
  soot: {
    kind: 'ash', tile: [0.5, 0.5], px: [256, 256], seed: 283, minPx: 128, hRange: 0.004,
    u: { uP0: [0.0006, 0.0, 0.0, 0.03], uC0: '#24211e', uC1: '#1b1816', uC2: '#0e0c0b', uC3: '#36281e' },
  },
  // the altar's lime in use (same tile and seed as `whitewash`, so the stones continue across keys). Walking
  // surfaces: the stones buried and worn down to faint bulges; broad bare-foot bands along v (one per 4 m), crazing, patches
  whitewash_worn: {
    kind: 'whitewash', tile: [4, 4], px: [512, 512], seed: 67,
    u: {
      uP0: [0.0035, 0.0018, 0.003, 0.0004], uP1: [0, 0.72, 0.04, 0.6], uP2: [1, 0, 0, 0], uP3: [4, 1, 1, 0],
      uC0: '#efece4', uC1: '#b5ad9e', uC2: '#8e2b1c',
    },
  },
  whitewash_soot: {
    kind: 'whitewash', tile: [4, 4], px: [512, 512], seed: 67,
    u: { uP0: [0.009, 0.004, 0.002, 0.0003], uP1: [0, 0.9, 0.04, 0.6], uP2: [0, 1, 0, 0], uC0: '#f3f1ea', uC1: '#c6c1b6', uC2: '#8e2b1c', uC3: '#4d4844' },
  },
  whitewash_stained: {
    kind: 'whitewash', tile: [4, 4], px: [512, 512], seed: 67,
    u: { uP0: [0.009, 0.004, 0.002, 0.0003], uP1: [0, 0.9, 0.04, 0.6], uP2: [0, 0, 1, 0.5], uC0: '#f3f1ea', uC1: '#c6c1b6', uC2: '#8e2b1c', uC4: '#70372b' },
  },
  // terrain_blend layers (pack 'blend': albedo+height, normal+roughness+AO), early November: r grey limestone
  // (6 m tile: 7.8 mm/texel on high; the 8 m tile at 10 mm read smeared close up)
  tb_rock: {
    kind: 'rock', tile: [6, 6], px: [704, 704], seed: 211, pack: 'blend',
    u: { uP0: [0.07, 0.9, 0.7, 0.6], uP1: [1.0, 0.6, 0.9, 0], uC0: '#8e8a81', uC1: '#837f77', uC2: '#6a6962', uC3: '#665445' },
  },
  // g (soil) is the open hillside — the builder's weights put vegetation only on cultivated ground — so it is stony
  // terra rossa with clumped dry grass tufts and grey dwarf-shrub cushions (batha); b (vegetation) is cultivated
  // ground: stubble rows over furrowed soil, a little new green after the first rains
  tb_soil: {
    kind: 'grass', tile: [6, 6], px: [640, 640], seed: 223, pack: 'blend',
    u: { uP0: [0.35, 0.35, 0.12, 0.1], uP1: [0.02, 0.04, 0.5, 0], uC0: '#6d5d4e', uC1: '#b3a888', uC2: '#6e6450', uC3: '#76776a', uC4: '#a8a091', uC5: '#6f7b4b' },
  },
  tb_veg: {
    kind: 'grass', tile: [6, 6], px: [640, 640], seed: 227, pack: 'blend',
    u: { uP0: [0.25, 0.12, 0.0, 0.25], uP1: [0.03, 0.02, 0.5, 0.3], uC0: '#685849', uC1: '#b8ab88', uC2: '#7f7459', uC3: '#6f6d5a', uC4: '#a69e8f', uC5: '#6c7a48' },
  },
  // olive leaves: dark grey-green and glossy above, a little paler and matte below; in sprays with dark gaps
  olive_leaves: {
    kind: 'leaves', tile: [1, 1], px: [512, 512], seed: 233, minPx: 256,
    u: { uP0: [0.064, 0.02, 0.98, 0.3], uP1: [0.16, 0.35, 0, 0], uP3: [0, 0, 0, 0], uC0: '#6a735f', uC1: '#8b907e', uC2: '#3e4537' },
  },
  olive_card: {
    kind: 'leaves', tile: [0.6, 0.6], px: [448, 448], seed: 239, minPx: 256,
    u: { uP0: [0.064, 0.02, 0.98, 0.3], uP1: [0.15, 0, 0.75, 0], uP3: [1, 0, 0, 0], uC0: '#6a735f', uC1: '#8b907e', uC2: '#3e4537' },
  },
  // city houses: rolled-earth roofs and field-stone rubble walls
  roof_earth: {
    kind: 'soil', tile: [6, 6], px: [512, 512], seed: 287,
    u: { uP0: [0.001, 0.025, 0.7, 0.008], uP1: [1, 0.5, 0.3, 0.004], uC0: '#857866', uC1: '#6d6052', uC2: '#ada393', uC3: '#968a77', uC4: '#c8bfab' },
  },
  rubble: {
    kind: 'rubble', tile: [4, 4], px: [512, 512], seed: 241,
    u: { uP0: [0.34, 0.2, 0.03, 0.045], uP1: [0.45, 0.025, 0.6, 0], uC0: '#a39d90', uC1: '#ad9f86', uC2: '#9a917f', uC3: '#8c8a76', uC4: '#857f6e' },
  },
  terracotta: {
    kind: 'clay', tile: [0.5, 0.5], px: [512, 512], seed: 281, minPx: 256,
    u: { uP0: [0.00012, 0.12, 0.55, 0.3], uC0: '#8b5b44', uC1: '#7a4b37', uC2: '#5a4a40', uC3: '#a08b72', uC4: '#a57a5c' },
  },
  hide: {
    kind: 'hide', tile: [0.75, 0.75], px: [512, 512], seed: 251, minPx: 256,
    u: { uP0: [0.005, 1.6, 0.55, 0.006], uC0: '#d2b49b', uC1: '#b88e78', uC2: '#e2cfa8', uC3: '#eeebe3', uC4: '#c49a8c' },
  },
  rope: {
    kind: 'rope', tile: [0.12, 0.12], px: [256, 256], seed: 277, minPx: 128,
    u: { uP0: [0.03, 0.0004, 0.004, 0], uC0: '#a99372', uC1: '#6d5c45' },
  },
  bread: {
    kind: 'crust', tile: [0.5, 0.5], px: [512, 512], seed: 269, minPx: 256,
    u: { uP0: [0.012, 0.55, 0.25, 0.4], uC0: '#e5cf9f', uC1: '#d2a865', uC2: '#8d5a2d', uC3: '#efe7d5' },
  },
  frankincense: {
    kind: 'lumps', tile: [0.3, 0.3], px: [512, 512], seed: 271, minPx: 256,
    u: { uP0: [0.016, 0.008, 0.2, 0.4], uC0: '#d9bb7a', uC1: '#b98a3e', uC2: '#ebe0c4', uC3: '#7d6a4a', uC4: '#f0d27a' },
  },
  // metals: tableware silver lightly tarnished; mirror-polished gold (Helena's nivreshet); worn kitchen copper
  // (hammered, an even brown oxide film rubbed bright along the ridges between the dishes); a seamless beaten-gold
  // sheet for door leaves
  silver: {
    kind: 'metal', tile: [0.5, 0.5], px: [384, 384], seed: 311, metal: true,
    u: { uP0: [0.0001, 0.014, 0.000012, 0.24], uP1: [0.4, 0.08, 0, 0.04], uP2: [0.0002, 3.0, 0.03, 0.3], uP3: [0, 0.75, 0, 0], uC0: '#ffffff', uC1: '#d8cdb8', uC2: '#000000' },
  },
  goldpolish: {
    kind: 'metal', tile: [0.5, 0.5], px: [384, 384], seed: 313, metal: true, hRange: 0.0008,
    u: { uP0: [0.00003, 0.02, 0.000003, 0.066], uP1: [0, 0, 0, 0.01], uP2: [0.00015, 3.0, 0.012, 0], uC0: '#ffffff', uC1: '#ffffff', uC2: '#000000' },
  },
  // world-4-fix: the film darker, even and mostly dielectric (cuprite brown: tarnish 0.88 → 1, uP3.x 0.4 → 0.7, uC1
  // #4f3328 → #3d271f); before, the metallic film mirrored the court and baked as light salmon copper, not the "even
  // brown oxide film" of its key
  copperworn: {
    kind: 'metal', tile: [0.5, 0.5], px: [384, 384], seed: 317, metal: true, hRange: 0.0015,
    u: { uP0: [0.00035, 0.016, 0.00002, 0.34], uP1: [1.0, 0.16, 0.005, 0.04], uP2: [0.0003, 4.0, 0.03, 0.3], uP3: [0.7, 1, 0.7, 0], uC0: '#ffffff', uC1: '#3d271f', uC2: '#5f8f7c' },
  },
  golddoor: {
    kind: 'metal', tile: [2, 2], px: [512, 512], seed: 331, metal: true, hRange: 0.004,
    u: { uP0: [0.0008, 0.025, 0.0, 0.3], uP1: [0, 0, 0, 0.02], uP2: [0.0012, 3.0, 0.03, 0.3], uC0: '#f7f4ee', uC1: '#ffffff', uC2: '#000000' },
  },

  // ---------------- textiles ----------------
  // shesh: fine six-ply linen, ~16 threads/cm (recon. count), plain weave (4 cm tile: 256 px = 4 texels a thread)
  linen: {
    kind: 'weave', tile: [0.04, 0.04], px: [256, 256], seed: 151, minPx: 192, hRange: 0.0004,
    u: { uP0: [0.000625, 0.9, 0.12, 0], uP1: [0.0025, 0.6, 0.82, 0.45], uP2: [6, 0, 0, 0], uC0: '#f0ebdf' },
  },
  curtain_linen: {
    kind: 'weave', tile: [0.064, 0.064], px: [256, 256], seed: 157, minPx: 192, hRange: 0.0006,
    u: { uP0: [0.001, 0.92, 0.18, 0], uP1: [0.004, 0.8, 0.85, 0.45], uP2: [6, 0, 0, 0], uC0: '#e8e1d0' },
  },
  // a tefach-thick cloth of 24-thread cords (Shekalim 8:5): every cord twists techelet, argaman, tola'at shani and
  // shesh. Techelet is wool dyed SKY-blue (Part VII §23); argaman red-purple, tola'at shani worm-crimson; the finer
  // linen ply takes ~6 % of the surface; ~5 % mean reflectance (deep-dyed, deep-piled wool). 1 m tile, 8 mm cords in plain weave, 12.3 mm twist (incommensurate with the
  // 16 mm float spacing); minPx 640 so every tier
  // keeps >= 5 texels a cord (medium and low drew a flat heather). Tones and shares: reconstruction.
  parochet: {
    kind: 'weave', tile: [1, 1], px: [640, 640], seed: 163, minPx: 640, hRange: 0.005, ao: [0.004, 0.0015, 0.55],
    u: {
      uP0: [0.008, 0.9, 0.03, 1], uP1: [0.0123, 1.0, 0.86, 0.75], uP2: [4, 0, 0.06, 0.25], uP3: [0.3, 0, 0, 0],
      uC1: '#2a4f80', uC2: '#4a0f2a', uC3: '#7a1020', uC4: '#8c8370',
    },
  },

  // ---------------- misc ----------------
  water: { kind: 'water', tile: [2, 2], px: [384, 384], seed: 167, u: { uP0: [1, 0, 0, 0] } },
  d_stone: { kind: 'detail', tile: [0.2, 0.2], px: [512, 512], seed: 179, minPx: 256, hRange: 0.0006, u: { uP0: [0, 0, 0, 0] } },
  d_metal: { kind: 'detail', tile: [0.2, 0.2], px: [512, 512], seed: 181, minPx: 256, hRange: 0.0002, u: { uP0: [1, 0, 0, 0] } },
  d_wood: { kind: 'detail', tile: [0.3, 0.3], px: [512, 512], seed: 191, minPx: 256, hRange: 0.0004, u: { uP0: [2, 0, 0, 0] } },
  d_cloth: { kind: 'detail', tile: [0.05, 0.05], px: [256, 256], seed: 193, minPx: 128, hRange: 0.0001, u: { uP0: [3, 0, 0, 0] } },
  // comb-chisel strokes for the drafted margins of the Herodian walls (patch.js MK_COMB)
  d_comb: { kind: 'detail', tile: [0.2, 0.2], px: [512, 512], seed: 197, minPx: 256, hRange: 0.0006, u: { uP0: [4, 0, 0, 0] } },
};

// grain-along-v views for vertical members (posts, door boards): the material swaps its UVs (patch.js) and samples
// the u set — no second bake (materials-2-fix: −13 MB on high)
for (const k of ['cedar', 'oak', 'olive', 'lattice_wood', 'weathered']) {
  const s = SETS[k];
  SETS[`${k}_v`] = { ...s, rotOf: k, tile: [s.tile[1], s.tile[0]], px: [s.px[1], s.px[0]] };
}

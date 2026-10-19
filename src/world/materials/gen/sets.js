// Texture SETS: kind + physical tile (m) + resolution at the reference size 2048 (scaled by
// quality.textureSize / 2048, floored at minPx) + parameters. Colours are sRGB hex (converted to linear
// when uploaded). One set may serve several materials (e.g. the vessel metals, tinted by material.color).
//
// Research: report Part VII §21 (materials matrix), §23 (fabrics), §24 (metals), §26 (palette), Part V §13.11.
// Dimensions marked "recon." are reconstruction — see docs/decisions/materials.md.

const herodianRows = (r) => [r % 3, r % 2 === 0 ? 1 : 0]; // course colour cycle white/kochla/veined × set out/in

// Kochla (blue-green banded marble): ONE palette for the wall courses and the monolithic marble_kochla —
// base, band (darker, bluer layers; modest contrast) and the sparse pale streaks.
const KOCHLA = { base: '#78878a', band: '#65747b', streak: '#a9b2b0' };

const marbleWall = {
  // shayish (white) · kochla (blue-green) · marmara (veined) — Bava Batra 4a; Part VII §21 #1, §26
  uC0: '#e9e5db', uC1: KOCHLA.base, uC2: '#e0dacd',
  uC3: '#c9c4bb', uC4: KOCHLA.streak, uC5: '#857f79', uC6: KOCHLA.band,
};

// firewood bark (Tamid 2:3): fig (smooth warm grey), walnut (dark grey-brown, furrowed), oil-tree read as
// Aleppo pine (grey-brown plate faces over red-brown fissures); split wood (pale)
const barkPalette = { uC0: '#6c665a', uC1: '#4f453c', uC2: '#3f2a20', uC3: '#6b5f52', uC4: '#a08a6c' };

const wood = (rings, warp, pores, knots, rough, weather, rays, figure, c0, c1, c2) => ({
  uP0: [rings, warp, pores, knots], uP1: [rough, weather, rays, figure], uC0: c0, uC1: c1, uC2: c2,
});

export const SETS = {
  // ---------------- stone ----------------
  herodian: {
    kind: 'herodian', tile: [13, 6.6], px: [2048, 1040], seed: 11,
    // courses 1.1 m, blocks 2–5 m (recon.); drafted margin ~11 cm (8.8–13.2), boss +8–16 mm with a crisp step,
    // dry hairline joints (1 mm half-width, 4 mm deep, 4 mm rounded arris), course set-out 4 cm with a 6 cm
    // soffit/shadow band on the top of each drawn-in course
    layout: { rowH: 1.1, q: 0.5, minL: 2.0, maxL: 5.0, gap: 0.75, rowType: herodianRows },
    u: { uP0: [0.11, 0.012, 0.001, 0.04], uP1: [1, 0.0004, 0.5, 1], uP2: [0.004, 0.004, 0.06, 0.3], ...marbleWall },
  },
  herodian_inner: {
    kind: 'herodian', tile: [13, 6.6], px: [1280, 650], seed: 11,
    layout: { rowH: 1.1, q: 0.5, minL: 2.0, maxL: 5.0, gap: 0.75, rowType: herodianRows },
    u: { uP0: [0.11, 0.0, 0.001, 0.04], uP1: [0, 0.0003, 0.35, 1], uP2: [0.005, 0.003, 0.05, 0.24], ...marbleWall },
  },
  ashlar: {
    kind: 'ashlar', tile: [9, 4.8], px: [1280, 684], seed: 23,
    layout: { rowH: 0.96, q: 0.5, minL: 1.0, maxL: 3.0, gap: 0.5 },
    u: { uP0: [0.002, 0.004, 0.0008, 0.008], uC0: '#dccfb6', uC1: '#d3c5a9', uC2: '#cbbd9f', uC3: '#8f8471' },
  },
  // the Heichal's annual lime wash (Middot 3:4) over large dressed ashlar: joints softened and mostly filled,
  // tooling muted, faint horizontal brush/cloth strokes; courses 1.1 m, blocks 1.5–4 m (recon.)
  ashlar_wash: {
    kind: 'ashlar', tile: [10, 4.4], px: [1280, 564], seed: 29,
    layout: { rowH: 1.1, q: 0.5, minL: 1.5, maxL: 4.0, gap: 0.6 },
    u: {
      uP0: [0.0015, 0.004, 0.0007, 0.006], uP1: [1, 0.0007, 0.8, 0],
      uC0: '#dccfb6', uC1: '#d3c5a9', uC2: '#cbbd9f', uC3: '#a69c8a', uC4: '#f0ede5',
    },
  },
  paving_mount: {
    kind: 'paving', tile: [10, 10], px: [1152, 1152], seed: 31,
    layout: { rowH: 1.25, q: 0.5, minL: 1.0, maxL: 2.5, gap: 0.5 },
    u: {
      uP0: [0.002, 0.008, 0.016, 0.6], uP1: [1, 0.72, 0.004, 0.004], uP2: [0.3, 0.1, 0.14, 0.3],
      uC0: '#d4cab5', uC1: '#c2b7a0', uC2: '#d8d3c6', uC3: '#aaa395', uC4: '#a39d92',
    },
  },
  paving_azarah: {
    kind: 'paving', tile: [10, 9.6], px: [1152, 1104], seed: 37,
    layout: { rowH: 1.6, q: 0.5, minL: 1.5, maxL: 3.5, gap: 0.5 },
    u: {
      uP0: [0.0012, 0.006, 0.006, 0.15], uP1: [1, 0.36, 0.0015, 0.001], uP2: [0.85, 0.06, 0.04, 0.85],
      uC0: '#e8e3d8', uC1: '#ded6c5', uC2: '#d4d1c8', uC3: '#bdb4a6', uC4: '#a29d95',
    },
  },
  steps: {
    kind: 'stone', tile: [3, 3], px: [768, 768], seed: 41,
    u: { uP0: [0.0006, 0.5, 0.6, 0.08], uC0: '#d8cdb7', uC1: '#d2c5ab' },
  },
  marble_white: {
    kind: 'marble', tile: [3, 3], px: [768, 768], seed: 43,
    u: { uP0: [0, 0.6, 0.3, 0.06], uC0: '#ece8df', uC1: '#b5b0a8', uC2: '#ece8df' },
  },
  marble_kochla: {
    kind: 'marble', tile: [3, 3], px: [768, 768], seed: 47,
    u: { uP0: [1, 0.6, 0.34, 0.05], uC0: KOCHLA.base, uC1: KOCHLA.streak, uC2: KOCHLA.band },
  },
  marble_veined: {
    kind: 'marble', tile: [3, 3], px: [768, 768], seed: 53,
    u: { uP0: [2, 0.6, 0.28, 0.06], uC0: '#e2dcd0', uC1: '#7d7873', uC2: '#e2dcd0' },
  },
  plaster: {
    kind: 'plaster', tile: [4, 4], px: [768, 768], seed: 59,
    u: { uP0: [0.0008, 0.00012, 0.4, 0], uP1: [0.3, 0.86, 0, 0], uC0: '#ebe5d7', uC1: '#dad1be', uC2: '#bfb5a2' },
  },
  // ma'azivah: the plaster/lime-concrete roof fill (Middot 4:6) — no roof tiles are attested
  roof: {
    kind: 'plaster', tile: [6, 6], px: [768, 768], seed: 61,
    u: { uP0: [0.0006, 0.0002, 0.6, 0.5], uP1: [0.55, 0.9, 0, 0], uC0: '#d2c9b6', uC1: '#aaa292', uC2: '#9d968a' },
  },
  // closely packed rounded stones ~25 / ~11 cm with warped outlines (4 cm), low pillows (9 / 4 mm) buried in broad
  // lime fillets, so they read as soft bulges under thick renewed lime; faint horizontal cloth-wipe strokes
  whitewash: {
    kind: 'whitewash', tile: [4, 4], px: [896, 896], seed: 67,
    u: { uP0: [0.009, 0.004, 0.002, 0.0003], uP1: [0, 0.9, 0.04, 0.6], uC0: '#f3f1ea', uC1: '#c6c1b6', uC2: '#8e2b1c' },
  },
  // same skin (same seed/tile) so the painted girdle continues the whitewashed stones exactly
  sikra: {
    kind: 'whitewash', tile: [4, 4], px: [512, 512], seed: 67,
    u: { uP0: [0.009, 0.004, 0.002, 0.0003], uP1: [1, 0.86, 0.04, 0.6], uC0: '#f3f1ea', uC1: '#c6c1b6', uC2: '#8f2a1b' },
  },
  bedrock: {
    kind: 'rock', tile: [4, 4], px: [768, 768], seed: 71,
    u: { uP0: [0.04, 0.5, 0.5, 0.0], uP1: [0.15, 0.15, 0.88, 0], uC0: '#c2b394', uC1: '#b3a486', uC2: '#8e8576', uC3: '#7d5a42' },
  },
  terrain_rock: {
    kind: 'rock', tile: [8, 8], px: [896, 896], seed: 73,
    u: { uP0: [0.08, 0.9, 0.7, 0.6], uP1: [0.55, 0.6, 0.9, 0], uC0: '#b7af9f', uC1: '#a8a090', uC2: '#7d7a72', uC3: '#7f5640' },
  },
  terrain_soil: {
    kind: 'soil', tile: [4, 4], px: [896, 896], seed: 79,
    u: { uP0: [0.005, 0.07, 0.4, 0.012], uC0: '#875a40', uC1: '#6e4834', uC2: '#bdb3a0', uC3: '#9c7a62' },
  },
  ash: {
    kind: 'ash', tile: [2, 2], px: [512, 512], seed: 83,
    u: { uP0: [0.006, 0.12, 0.35, 0], uC0: '#bcb6ae', uC1: '#9f9991', uC2: '#2a2522', uC3: '#4e3a2a' },
  },

  // ---------------- metal ----------------
  goldplate: {
    kind: 'goldplate', tile: [5.76, 2.88], px: [1280, 640], seed: 89, metal: true, hRange: 0.005,
    // sheets 1 amah high, 1.5–3 amot long (recon.); hammer dishes 1 mm deep on ~2.5 cm cells, the sheet
    // undulating ±1–2 mm over 20–40 cm; sheets matched closely (rough ±0.005, tone ±0.008)
    layout: { rowH: 0.48, q: 0.24, minL: 0.72, maxL: 1.44, gap: 0.24 },
    u: { uP0: [0.0008, 0.0004, 0.001, 0.025], uP1: [0.3, 0.005, 0.002, 1], uP2: [0.008, 0, 0, 0] },
  },
  relief: {
    kind: 'relief', tile: [3.84, 2.88], px: [1280, 960], seed: 97, metal: true,
    u: { uP0: [0.013, 0.48, 1.92, 0.0012], uP1: [0.2, 0.34, 0.00008, 0] },
  },
  vessel: {
    kind: 'metal', tile: [0.5, 0.5], px: [512, 512], seed: 101, metal: true,
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
    kind: 'metal', tile: [0.5, 0.5], px: [512, 512], seed: 107, metal: true,
    u: { uP0: [0.00018, 0.012, 0.00002, 0.25], uP1: [0.5, 0.12, 0.1, 0.06], uC0: '#ffffff', uC1: '#a8735a', uC2: '#5f8f7c' },
  },
  iron: {
    kind: 'iron', tile: [1, 1], px: [512, 512], seed: 109, metal: true,
    u: { uP0: [0.0006, 0.35, 0.6, 1.0], uC0: '#3a3836', uC1: '#7a4528', uC2: '#4a2a1a' },
  },

  // ---------------- wood (grain along u; *_v along v) ----------------
  cedar: { kind: 'wood', tile: [2, 0.5], px: [1024, 256], seed: 113, u: wood(60, 0.35, 0.5, 0.08, 0.62, 0, 0, 0, '#9e6c4a', '#74482f', '#6a4028') },
  oak: { kind: 'wood', tile: [2, 0.5], px: [1024, 256], seed: 127, u: wood(40, 0.45, 1.0, 0.06, 0.64, 0, 0.8, 0, '#9a7a55', '#6c5136', '#5a4430') },
  olive: { kind: 'wood', tile: [2, 0.5], px: [1024, 256], seed: 131, u: wood(70, 0.6, 0.3, 0.05, 0.5, 0, 0, 0.8, '#b59a6a', '#8f764e', '#4f3d2a') },
  lattice_wood: { kind: 'wood', tile: [2, 0.5], px: [1024, 256], seed: 137, u: wood(45, 0.4, 0.6, 0.04, 0.8, 0.7, 0, 0, '#94805f', '#6f5d45', '#7a6e60') },
  // altar firewood: fig, walnut, oil-tree (pine) logs (Tamid 2:3); rows = logs ~12–16 cm (recon.), 15 % split
  logs: {
    kind: 'logs', tile: [2.4, 0.96], px: [1024, 410], seed: 139,
    layout: { rowH: 0.16, q: 0.12, minL: 0.48, maxL: 1.08, gap: 0.12 },
    u: { uP0: [0, 0.15, 0, 0], ...barkPalette },
  },
  // bark surface for modelled logs and rough timbers (same species, in large patches)
  bark: {
    kind: 'logs', tile: [2.4, 0.96], px: [1024, 410], seed: 141,
    layout: { rowH: 0.16, q: 0.12, minL: 0.48, maxL: 1.08, gap: 0.12 },
    u: { uP0: [1, 0, 0, 0], ...barkPalette },
  },
  // the pile's end faces: one log end per block (rows 16 cm, 16–20 cm wide), rings 3–6 mm, bark rim ~1 cm
  logend: {
    kind: 'logend', tile: [0.96, 0.96], px: [512, 512], seed: 143, minPx: 256,
    layout: { rowH: 0.16, q: 0.04, minL: 0.16, maxL: 0.2, gap: 0.06 },
    u: { uP0: [0.0045, 0.01, 0.8, 0.04], uC0: '#968e7c', uC1: '#5a4738', uC2: '#a08a6a', uC3: '#463d35', uC4: '#8d7d66' },
  },
  lattice: {
    kind: 'lattice', tile: [0.96, 0.96], px: [512, 512], seed: 149, minPx: 256,
    // spacing chosen so the diagonal pattern repeats exactly in the tile (4 slats per tile diagonal)
    u: { uP0: [0.96 / Math.SQRT2 / 4, 0.045, 0.02, 0], uC0: '#93806a', uC1: '#6f5e4b' },
  },

  // ---------------- textiles ----------------
  // shesh: fine six-ply linen, ~16 threads/cm (recon. count), plain weave
  linen: {
    kind: 'weave', tile: [0.04, 0.04], px: [512, 512], seed: 151, minPx: 256, hRange: 0.0004,
    u: { uP0: [0.000625, 0.9, 0.12, 0], uP1: [0.0025, 0.6, 0.82, 0.45], uP2: [6, 0, 0, 0], uC0: '#f0ebdf' },
  },
  curtain_linen: {
    kind: 'weave', tile: [0.064, 0.064], px: [512, 512], seed: 157, minPx: 256, hRange: 0.0006,
    u: { uP0: [0.001, 0.92, 0.18, 0], uP1: [0.004, 0.8, 0.85, 0.45], uP2: [6, 0, 0, 0], uC0: '#e8e1d0' },
  },
  // a tefach-thick cloth of 24-thread cords (Shekalim 8:5): every cord twists techelet, argaman, tola'at shani
  // and shesh. Reconstruction: 12 mm cords in a 2/2 twill (floats long enough to show the four-ply spiral),
  // 2.4 cm twist (each 2-cord float shows all four plies, so the colours mix evenly; whole number per tile),
  // deep shadowed gaps; deep dyes (indigo-like techelet, red-purple argaman, kermes crimson) and a natural
  // linen ply taking ~12 % of the surface (the linen thread finer than the wool), varying gently
  parochet: {
    kind: 'weave', tile: [0.384, 0.384], px: [512, 512], seed: 163, minPx: 256, hRange: 0.006, ao: [0.006, 0.002, 0.6],
    u: {
      uP0: [0.012, 0.9, 0.02, 1], uP1: [0.024, 1.0, 0.86, 0.65], uP2: [4, 1, 0.12, 0.2],
      uC1: '#15295e', uC2: '#3b0f36', uC3: '#6e0c19', uC4: '#aaa089',
    },
  },

  // ---------------- misc ----------------
  water: { kind: 'water', tile: [2, 2], px: [512, 512], seed: 167, u: { uP0: [1, 0, 0, 0] } },
  d_stone: { kind: 'detail', tile: [0.2, 0.2], px: [512, 512], seed: 179, minPx: 256, hRange: 0.0006, u: { uP0: [0, 0, 0, 0] } },
  d_metal: { kind: 'detail', tile: [0.2, 0.2], px: [512, 512], seed: 181, minPx: 256, hRange: 0.0002, u: { uP0: [1, 0, 0, 0] } },
  d_wood: { kind: 'detail', tile: [0.3, 0.3], px: [512, 512], seed: 191, minPx: 256, hRange: 0.0004, u: { uP0: [2, 0, 0, 0] } },
  d_cloth: { kind: 'detail', tile: [0.05, 0.05], px: [256, 256], seed: 193, minPx: 128, hRange: 0.0001, u: { uP0: [3, 0, 0, 0] } },
};

// grain-along-v variants for vertical members (posts, door boards)
for (const k of ['cedar', 'oak', 'olive', 'lattice_wood']) {
  const s = SETS[k];
  SETS[`${k}_v`] = {
    ...s, tile: [s.tile[1], s.tile[0]], px: [s.px[1], s.px[0]],
    u: { ...s.u, uP3: [0, 0, 0, 1] },
  };
}

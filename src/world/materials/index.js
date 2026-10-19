// Material library — ctx.mats.get(key) -> THREE.Material (shared instances; never mutate per-mesh).
//
// Procedural PBR: every textured material is a stock MeshStandardMaterial (MeshPhysicalMaterial for water
// and, on high/ultra, cloth sheen) with albedo + packed normal + AO/roughness(/metalness) maps baked on the
// GPU at load (gen/), in WORLD-scaled UVs (1 UV = 1 m; each texture's repeat = 1 / its physical tile size).
// An optional, chained onBeforeCompile patch (patch.js) adds world-space macro variation, per-stone
// variation and close-range micro detail; without it the materials still render correctly.
//
// Keys are stable (only ever added). Research grounding per key: `info` below, report Part VII §21/§23/§24/§26
// and Part V §13.11; reconstruction choices are logged in docs/decisions/materials.md.
//
// API: get(key), keys, ready(), has(key), info(key) -> research metadata, tile(key) -> { tile: [w,h] m,
// rowH } (e.g. the 1.1 m Herodian course height, to align modelled courses), stats (ms / MB), bakeAll(),
// rebuild(quality) (also on 'quality:change'), dispose(); baker (debug).
// Conventions for builders: UVs in meters (applyWorldUV); wood grain runs along U (use the *_v keys for
// posts/door boards); herodian_wall courses follow world height (v = y) — horizontal faces (wall tops) should
// use another key (ashlar_plain / paving_*); timber_rough = bark for modelled logs, timber_pile = the long faces of a
// log pile (logs along U), timber_pile_end = its end faces; lime_whitewash = the altar, heichal_whitewash = washed ashlar.
// URL: ?matfx=0 disables the shader patch; ?mattex=0 forces flat (untextured) materials.
import { MeshStandardMaterial, MeshPhysicalMaterial, DoubleSide, Color, Vector2, Vector4 } from 'three';
import { Baker } from './gen/baker.js';
import { SETS } from './gen/sets.js';
import { applyPatch } from './patch.js';

// measured F0 of gold, linear (1.0, 0.766, 0.336) -> sRGB #ffe39d (pure gold; the other grades are tints)
const GOLD = '#ffe39d';

// macro variation presets: [albedo amp, roughness amp, scale (m), tint amp, tint (sRGB)]
const MAC = {
  wall: [0.05, 0.05, 23, 0.25, '#e4d8c3'],
  pave: [0.07, 0.10, 11, 0.30, '#d6c8ad'],
  stone: [0.05, 0.05, 9, 0.2, '#e0d4bf'],
  marble: [0.03, 0.04, 7, 0.1, '#e8e0d0'],
  lime: [0.025, 0.03, 9, 0.2, '#e8e2d6'],
  ground: [0.14, 0.05, 17, 0.4, '#b39a7c'],
  metal: [0.02, 0.02, 6, 0, '#ffffff'],
  wood: [0.06, 0.04, 5, 0.15, '#c8b79e'],
  cloth: [0.035, 0.03, 3, 0, '#ffffff'],
  none: [0, 0, 10, 0, '#ffffff'],
};
// close-range detail presets: [detail set, uv scale (1/m), normal strength, albedo amp, roughness amp]
const DET = {
  stone: ['d_stone', 5, 0.55, 0.05, 0.06],
  marble: ['d_stone', 5, 0.25, 0.03, 0.04],
  lime: ['d_stone', 5, 0.35, 0.03, 0.04],
  metal: ['d_metal', 5, 0.35, 0.015, 0.08],
  wood: ['d_wood', 3.333, 0.45, 0.06, 0.05],
  cloth: ['d_cloth', 20, 0.25, 0.03, 0.03],
};

/**
 * key: {
 *   set: texture set id (gen/sets.js) or null (flat colour),
 *   color: sRGB multiplier (metal F0 for metals; white for colour-in-texture sets), rough / metal: scalars
 *     (multipliers when the set has an ORM map), normal: normalScale,
 *   macro / detail: presets above, block: [albedo, roughness, hue] amplitudes (masonry/sheet sets),
 *   physical, sheen: [colour, roughness] (high/ultra), side, alphaTest,
 *   flat: [colour, roughness, metalness] used when texture generation is unavailable,
 *   info: { en, he, note, sources, confidence }
 * }
 */
export const SPEC = {
  // ----------------------------------------------------------------- stone
  herodian_wall: {
    set: 'herodian', macro: MAC.wall, block: [0.06, 0.05, 0.03], detail: DET.stone, flat: ['#ddd6c6', 0.6, 0],
    info: {
      en: 'Herodian marble ashlar — courses of white, blue-green and veined marble, one course set out and one drawn in, left unplastered ("like the waves of the sea"); drafted margins and raised boss',
      sources: ['Bava Batra 4a', 'Sukkah 51b', 'Part VII §21 #1, §25', 'Part V §13.11'],
      confidence: 'derived', note: 'course height 1.1 m, block lengths 2–5 m, margin/boss dimensions: reconstruction',
    },
  },
  herodian_wall_inner: {
    set: 'herodian_inner', macro: MAC.wall, block: [0.06, 0.05, 0.03], detail: DET.stone, flat: ['#ddd6c6', 0.55, 0],
    info: {
      en: 'Same marble coursing with plain fine-dressed faces (no drafted margins) — inner/court faces, close-range facades',
      sources: ['Bava Batra 4a'], confidence: 'reconstruction', note: 'face finish of inner faces unattested',
    },
  },
  marble_white: {
    set: 'marble_white', macro: MAC.marble, detail: DET.marble, flat: ['#e9e4d8', 0.45, 0],
    info: { en: 'Shayish — white marble (monolithic: columns, tables, slabs)', sources: ['Bava Batra 4a', 'Shekalim 6:4', 'Part VII §26'], confidence: 'explicit' },
  },
  marble_kochla: {
    set: 'marble_kochla', macro: MAC.marble, detail: DET.marble, flat: ['#76858a', 0.45, 0],
    info: {
      en: 'Kochla — blue-green banded marble (the same stone and palette as the kochla courses of herodian_wall)',
      sources: ['Bava Batra 4a', 'Part VII §21 #1, §26', 'Part X (Magen: dark kohl-blue)'], confidence: 'derived',
      note: 'tone and banding are reconstruction',
    },
  },
  marble_veined: {
    set: 'marble_veined', macro: MAC.marble, detail: DET.marble, flat: ['#d8d0c2', 0.40, 0],
    info: { en: 'Marmara — veined marble', sources: ['Bava Batra 4a', 'Part VII §21 #1'], confidence: 'derived' },
  },
  ashlar_plain: {
    set: 'ashlar', macro: MAC.wall, block: [0.07, 0.05, 0.03], detail: DET.stone, flat: ['#d9cfbb', 0.75, 0],
    info: {
      en: 'Large whole dressed stones (chambers, inner faces) — hewn off-site, no iron on site',
      sources: ['Rambam BhB 1:8–9', 'Part V §13.11'], confidence: 'derived', note: 'limestone colour, 0.96 m courses: reconstruction',
    },
  },
  paving_mount: {
    set: 'paving_mount', macro: MAC.pave, block: [0.06, 0.08, 0.03], detail: DET.stone, flat: ['#cfc4ad', 0.8, 0],
    info: {
      en: 'Har HaBayit pavement — large weathered pale marble slabs in rows',
      sources: ['Ezrat Kohanim I p.184 (Part X)'], confidence: 'reconstruction', note: 'slab sizes (rows 1.25 m) reconstruction',
    },
  },
  paving_azarah: {
    set: 'paving_azarah', macro: MAC.pave, block: [0.05, 0.08, 0.02], detail: DET.marble, flat: ['#d6cdbd', 0.55, 0],
    info: {
      en: 'Azarah floor — "precious stones" (avanim yekarot): large fitted fine marble slabs, tight joints, worn smooth by bare feet',
      sources: ['Rambam BhB 1:10', 'Zevachim 24a', 'Part VII §21 #9'], confidence: 'derived', note: 'slab sizes and stone colour: reconstruction',
    },
  },
  steps_stone: {
    set: 'steps', macro: MAC.stone, detail: DET.stone, flat: ['#d3c8b2', 0.7, 0],
    info: { en: 'Stone steps (Chel, the 15 steps, Ulam steps) — dressed hard limestone', sources: ['Middot 2:3, 2:5, 3:6'], confidence: 'derived' },
  },
  lime_whitewash: {
    set: 'whitewash', macro: MAC.lime, detail: DET.lime, flat: ['#f2efe6', 0.85, 0],
    info: {
      en: 'The altar (and kevesh): whole rounded field-stones in a lime/lead/pitch slurry, whitewashed with lime twice a year (Pesach, Sukkot) — no iron trowel; Rebbi: wiped with a cloth every Erev Shabbat. (The Heichal, washed once a year at Pesach, is heichal_whitewash.)',
      sources: ['Middot 3:4', 'Zevachim 54a', 'Rambam BhB 1:14–16, 2:16'], confidence: 'derived', note: 'stone sizes / lime thickness reconstruction',
    },
  },
  sikra_red: {
    set: 'sikra', macro: MAC.lime, detail: DET.lime, flat: ['#8f2a1d', 0.8, 0],
    info: { en: 'Chut hasikra — red ochre line girding the altar at mid-height', sources: ['Middot 3:1', 'Zevachim 53a'], confidence: 'explicit' },
  },
  plaster: {
    set: 'plaster', macro: MAC.lime, detail: DET.lime, flat: ['#e8e2d4', 0.9, 0],
    info: { en: 'Lime plaster (sid)', sources: ['Part VII §21'], confidence: 'reconstruction' },
  },
  bedrock: {
    set: 'bedrock', macro: MAC.ground, detail: DET.stone, flat: ['#b9a98c', 0.95, 0],
    info: { en: 'Bare bedrock — the Even Shetiyah, rising 3 etzba\'ot above the floor', sources: ['Yoma 5:2, 53b', 'Part V §13.8'], confidence: 'derived' },
  },
  terrain_soil: {
    set: 'terrain_soil', macro: MAC.ground, detail: DET.stone, flat: ['#8c5a3c', 1.0, 0],
    info: { en: 'Terra rossa soil between the rocks', sources: ['regional geology'], confidence: 'reconstruction' },
  },
  terrain_rock: {
    set: 'terrain_rock', macro: MAC.ground, detail: DET.stone, flat: ['#a8977a', 0.95, 0],
    info: { en: 'Jerusalem limestone outcrops (karst)', sources: ['regional geology'], confidence: 'reconstruction' },
  },
  ash: {
    set: 'ash', macro: MAC.ground, flat: ['#8f8a84', 1.0, 0],
    info: { en: 'Wood ash — the tapuach and Beit HaDeshen', sources: ['Tamid 1:4, 2:2'], confidence: 'derived' },
  },
  // ----------------------------------------------------------------- metal (colour = F0, sRGB)
  gold_plate: {
    set: 'goldplate', color: GOLD, rough: 0.85, metal: 1, macro: MAC.metal, block: [0.005, 0, 0.002], detail: DET.metal,
    flat: ['#d4a640', 0.22, 1],
    info: {
      en: 'Beaten gold sheets (rikuei zahav) over walls and gate doors — visible seams, hammer dishing',
      sources: ['Middot 2:3, 4:1', 'Shekalim 4:4', 'Part VII §24'], confidence: 'derived', note: 'sheet size 1 × 1.5–3 amot, hammering and waviness: reconstruction',
    },
  },
  gold_relief: {
    set: 'relief', color: GOLD, metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#d4a640', 0.25, 1],
    info: {
      en: 'Kodesh walls: gold fitted evenly over carved keruvim, palm trees and open flowers',
      sources: ['Middot 4:1', 'Yoma 54a (keruvim d\'tzurta)', '1 Melachim 6:29', 'Part VII §21 #20'],
      confidence: 'reconstruction', note: 'motif drawing, scale and arrangement are reconstruction',
    },
  },
  gold_green: {
    set: 'vessel', color: '#f0e6a6', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#c8b04a', 0.25, 1],
    info: { en: 'Greenish gold — the daily machtah', sources: ['Yoma 44b–45a', 'Part VII §24'], confidence: 'derived' },
  },
  gold_red: {
    set: 'vessel', color: '#fbbd90', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#c9803a', 0.25, 1],
    info: { en: 'Zahav parvayim — red gold "like the blood of bulls" (Yom Kippur machtah)', sources: ['Yoma 44b–45a'], confidence: 'derived' },
  },
  gold_vessel: {
    set: 'vessel', color: GOLD, metal: 1, rough: 0.9, macro: MAC.metal, detail: DET.metal, flat: ['#e0b34c', 0.18, 1],
    info: { en: 'Gold service vessels (menorah, table, incense altar, cups)', sources: ['Part VII §24'], confidence: 'derived' },
  },
  bronze_corinthian: {
    set: 'bronze', color: '#f4d29e', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#c99a55', 0.28, 1],
    info: {
      en: 'Corinthian bronze (nechoshet kelonita) — Nikanor\'s doors, unplated, "gleamed like gold": polished cast bronze with a warm sheen',
      sources: ['Yoma 38a', 'Middot 2:3'], confidence: 'explicit', note: 'surface finish (polish, casting waviness, patina in recesses): reconstruction',
    },
  },
  copper: {
    set: 'copper', color: '#f6c6aa', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#b66d43', 0.35, 1],
    info: { en: 'Copper/bronze — the kiyor and its fittings', sources: ['Shemot 30:18, 38:8', 'Yoma 37a'], confidence: 'derived' },
  },
  silver: {
    set: 'vessel', color: '#f6f3ec', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#cfd2d6', 0.2, 1],
    info: { en: 'Silver — table W of the ramp, machtah, trumpets, Pesach basins', sources: ['Shekalim 6:4', 'Tamid 1:4', 'Part VII §24'], confidence: 'derived' },
  },
  iron: {
    set: 'iron', color: '#ffffff', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#3d3b3a', 0.55, 1],
    info: { en: 'Dark forged iron — kalya orev blade, flaying hooks, knives (never on the altar)', sources: ['Middot 3:4–5, 4:6', 'Rambam BhB 4:3'], confidence: 'explicit' },
  },
  // ----------------------------------------------------------------- wood (grain along U; *_v along V)
  cedar: {
    set: 'cedar', macro: MAC.wood, detail: DET.wood, flat: ['#8a5a36', 0.65, 0],
    info: { en: 'Cedar — tie-beams, block caps of the nanasin, posts', sources: ['Middot 3:5, 3:8, 4:5'], confidence: 'explicit' },
  },
  oak_milah: {
    set: 'oak', macro: MAC.wood, detail: DET.wood, flat: ['#7a5a3a', 0.65, 0],
    info: { en: 'Milah wood (oak/ash) — the five Ulam lintel beams', sources: ['Middot 3:7'], confidence: 'explicit' },
  },
  olive_wood: {
    set: 'olive', macro: MAC.wood, detail: DET.wood, flat: ['#9c8458', 0.55, 0],
    info: { en: 'Olive wood — Heichal doors (under gold)', sources: ['Part VII §21 #20'], confidence: 'derived' },
  },
  wood_lattice: {
    set: 'lattice_wood', macro: MAC.wood, detail: DET.wood, flat: ['#8b6f4a', 0.75, 0],
    info: { en: 'Soreg slat wood (weathered) — for modelled slats', sources: ['Middot 2:3 with Bartenura'], confidence: 'derived' },
  },
  timber_rough: {
    set: 'bark', macro: MAC.wood, detail: DET.wood, flat: ['#6e5137', 0.85, 0],
    info: {
      en: 'Rough timber / firewood bark — fig, walnut and oil-tree (pine); never olive or vine (for modelled logs and rough timbers)',
      sources: ['Tamid 2:3'], confidence: 'explicit', note: 'species identification of etz shemen as pine follows the common reading; bark looks reconstruction',
    },
  },
  // ----------------------------------------------------------------- textiles
  linen_white: {
    set: 'linen', side: DoubleSide, macro: MAC.cloth, detail: DET.cloth, sheen: ['#ffffff', 0.55], flat: ['#f1ede2', 0.9, 0],
    info: { en: 'Shesh — fine six-ply white linen, plain weave', sources: ['Part VIII §34', 'Part VII §23'], confidence: 'derived', note: 'thread count reconstruction' },
  },
  parochet: {
    set: 'parochet', side: DoubleSide, macro: MAC.cloth, detail: DET.cloth, sheen: ['#3c2232', 0.6], flat: ['#5a3a4a', 0.85, 0],
    info: {
      en: 'Parochet — every cord twisted of techelet, argaman, tola\'at shani and shesh (4 × 6 threads), a tefach thick; no woven figures',
      sources: ['Shekalim 8:5', 'Yoma 71b', 'Rambam Klei HaMikdash 7:16, 8:13–15', 'Part VII §23'],
      confidence: 'derived', note: 'cord size (12 mm), 2/2 twill, twist, dye tones and the linen ply share are reconstruction; figures not attested and not drawn',
    },
  },
  curtain_linen: {
    set: 'curtain_linen', side: DoubleSide, macro: MAC.cloth, detail: DET.cloth, sheen: ['#ffffff', 0.6], flat: ['#ece6d6', 0.9, 0],
    info: { en: 'Heavy linen curtain / screening sheet', sources: ['Yoma 3:4', 'Yoma 54a'], confidence: 'derived' },
  },
  // ----------------------------------------------------------------- misc
  water: {
    set: 'water', color: '#1f3438', rough: 0.05, physical: true, macro: MAC.none, flat: ['#3e5b66', 0.05, 0],
    info: { en: 'Still water (kiyor, mikvaot, the amah channel)', sources: [], confidence: 'derived' },
  },
  glass_dark: { set: null, flat: ['#111111', 0.3, 0], info: { en: 'Dark glossy surface (utility)', sources: [], confidence: 'reconstruction' } },
  roof_tile: {
    set: 'roof', macro: MAC.lime, detail: DET.lime, flat: ['#c9c0ae', 0.9, 0],
    info: {
      en: 'Roof surface = ma\'azivah, the plaster/lime-concrete roof fill (no roof tiles are attested; key kept for compatibility)',
      sources: ['Middot 4:6', 'Part V §13.11'], confidence: 'derived',
    },
  },
  debug: { set: null, flat: ['#ff00ff', 0.5, 0], info: { en: 'debug', sources: [], confidence: 'reconstruction' } },

  // ----------------------------------------------------------------- added keys
  roof_plaster: { alias: 'roof_tile' },
  wood_lattice_screen: {
    set: 'lattice', side: DoubleSide, alphaTest: 0.5, macro: MAC.wood, detail: DET.wood, flat: ['#8b6f4a', 0.8, 0],
    info: {
      en: 'Soreg as a single cut-out panel: wooden slats crossed diagonally, open between (10 tefachim high)',
      sources: ['Middot 2:3 with Bartenura'], confidence: 'derived', note: 'slat width/spacing reconstruction',
    },
  },
  timber_pile: {
    set: 'logs', macro: MAC.wood, block: [0.06, 0.03, 0.03], detail: DET.wood, flat: ['#5a4a3c', 0.9, 0],
    info: {
      en: 'A stacked pile of altar logs as one surface — the long faces, logs running along U (rows of ~12–16 cm fig, walnut and pine logs, some split); use timber_pile_end on the faces where the logs end',
      sources: ['Tamid 2:3', 'Middot 2:5 (wood chamber)'], confidence: 'reconstruction',
    },
  },
  timber_pile_end: {
    set: 'logend', macro: MAC.wood, block: [0.08, 0.04, 0.03], detail: DET.wood, flat: ['#8a7358', 0.9, 0],
    info: {
      en: 'End faces of a stacked log pile: log ends with growth rings, bark rim and drying checks, dark gaps between (fig, walnut, pine)',
      sources: ['Tamid 2:3'], confidence: 'reconstruction', note: 'log sizes, ring spacing, checks: reconstruction',
    },
  },
  heichal_whitewash: {
    set: 'ashlar_wash', macro: MAC.lime, block: [0.025, 0.03, 0.01], detail: DET.lime, flat: ['#efebe2', 0.88, 0],
    info: {
      en: 'Lime whitewash over large dressed ashlar — the Heichal, whitewashed once a year at Pesach (Middot 3:4 "וההיכל, פעם אחת, בפסח"): joints softened and mostly filled, fresher and brighter than bare stone',
      sources: ['Middot 3:4', 'Rambam BhB 4:13', 'Part V §13.6, §13.11'], confidence: 'derived',
      note: 'which faces were washed (vs the bare marble Ulam facade) is for build-heichal to decide and log; stone sizes and wash texture: reconstruction',
    },
  },
  cedar_v: { set: 'cedar_v', macro: MAC.wood, detail: DET.wood, flat: ['#8a5a36', 0.65, 0], info: { en: 'Cedar, grain along V (posts)', sources: ['Middot 4:5'], confidence: 'explicit' } },
  oak_milah_v: { set: 'oak_v', macro: MAC.wood, detail: DET.wood, flat: ['#7a5a3a', 0.65, 0], info: { en: 'Milah wood, grain along V', sources: ['Middot 3:7'], confidence: 'explicit' } },
  olive_wood_v: { set: 'olive_v', macro: MAC.wood, detail: DET.wood, flat: ['#9c8458', 0.55, 0], info: { en: 'Olive wood, grain along V (door boards)', sources: ['Part VII §21 #20'], confidence: 'derived' } },
  wood_lattice_v: { set: 'lattice_wood_v', macro: MAC.wood, detail: DET.wood, flat: ['#8b6f4a', 0.75, 0], info: { en: 'Soreg slat wood, grain along V', sources: ['Middot 2:3'], confidence: 'derived' } },
};

const KEYS = Object.keys(SPEC);

function warnOnce(store, key, ...args) {
  if (store.has(key)) return;
  store.add(key);
  console.warn(...args);
}

export function createMaterialLibrary(ctx) {
  const q = ctx.quality || {};
  const raw = ctx.params?.raw;
  const warned = new Set();
  const patchState = { enabled: raw?.get?.('matfx') !== '0', detail: (q.detail ?? 1) >= 1 };
  let failed = raw?.get?.('mattex') === '0' || !ctx.renderer;
  let baker = null;
  if (!failed) {
    try {
      baker = new Baker(ctx.renderer, { textureSize: q.textureSize || 1024, anisotropy: q.anisotropy || 4 });
    } catch (e) {
      failed = true;
      console.warn('[mats] texture baker unavailable — flat materials', e);
    }
  }
  const cache = new Map();
  const shared = { details: new Map() };
  const B = () => baker?.stats || {};
  const stats = {
    readyMs: 0, gpuMs: 0,
    get compileMs() { return Math.round(B().compileMs || 0); },
    get basisMs() { return Math.round(B().basisMs || 0); },
    get bakeMs() { return Math.round(B().bakeMs || 0); },
    get sets() { return B().sets || 0; },
    /** GPU memory of the baked sets + basis maps */
    get bytes() { return (B().bytes || 0) + (B().basisBytes || 0); },
    get MB() { return +(((B().bytes || 0) + (B().basisBytes || 0)) / 1048576).toFixed(1); },
    toJSON() {
      const { readyMs, gpuMs, compileMs, basisMs, bakeMs, sets, MB } = this;
      return { readyMs: Math.round(readyMs), gpuMs: Math.round(gpuMs), compileMs, basisMs, bakeMs, sets, MB };
    },
  };

  function getSet(id) {
    if (failed || !id) return null;
    try {
      return baker.get(id);
    } catch (e) {
      warnOnce(warned, `set:${id}`, `[mats] texture set "${id}" failed — flat fallback`, e);
      return null;
    }
  }

  function macroTex() {
    return baker?.noiseTex || null;
  }

  function detailTex(id) {
    if (!shared.details.has(id)) shared.details.set(id, getSet(id));
    return shared.details.get(id)?.map || null;
  }

  function patchUniforms(s, set) {
    const mac = s.macro || MAC.none;
    const det = s.detail;
    const blk = (set?.layout && s.block) || null;
    const dtex = det && patchState.detail ? detailTex(det[0]) : null;
    return {
      mkMacroMap: { value: macroTex() },
      mkMacro: { value: new Vector4(mac[0], mac[1], 1 / mac[2], mac[3]) },
      mkTint: { value: new Color(mac[4]) },
      mkBlock: { value: blk ? new Vector4(set.layout.q, set.layout.rowH, set.layout.dMax, blk[0]) : new Vector4(1, 1, 1, 0) },
      mkBlockR: { value: new Vector2(blk ? blk[1] : 0, blk ? blk[2] || 0 : 0) },
      mkDetailMap: { value: dtex },
      mkDetail: { value: dtex ? new Vector4(det[1], det[2], det[3], det[4]) : new Vector4(0, 0, 0, 0) },
      mkDetailFade: { value: new Vector2(2.5, 12) },
    };
  }

  function make(key) {
    const s = SPEC[key];
    if (!s) {
      warnOnce(warned, `key:${key}`, `[mats] unknown material "${key}" — using debug`);
      return get('debug');
    }
    if (s.alias) return get(s.alias);
    const set = getSet(s.set);
    const hi = (q.detail ?? 1) >= 2;
    const usePhysical = !!s.physical || (!!s.sheen && hi);
    const M = usePhysical ? MeshPhysicalMaterial : MeshStandardMaterial;
    const m = new M();
    m.name = key;
    if (s.side) m.side = s.side;
    if (s.alphaTest) m.alphaTest = s.alphaTest;
    if (set) {
      m.color.set(s.color || '#ffffff');
      m.map = set.map;
      m.normalMap = set.normal;
      m.normalScale.set(s.normal ?? 1, s.normal ?? 1);
      m.roughnessMap = set.orm;
      m.aoMap = set.orm;
      m.roughness = s.rough ?? 1;
      if (set.metal) {
        m.metalnessMap = set.orm;
        m.metalness = s.metal ?? 1;
      } else {
        m.metalness = s.metal ?? 0;
      }
      if (patchState.enabled) {
        const uniforms = patchUniforms(s, set);
        m.userData.mkUniforms = uniforms;
        applyPatch(m, uniforms, patchState);
      }
    } else {
      const [c, r, mt] = s.flat || ['#ff00ff', 0.5, 0];
      m.color.set(c);
      m.roughness = r;
      m.metalness = mt;
    }
    if (usePhysical && s.sheen) {
      m.sheen = 1;
      m.sheenColor.set(s.sheen[0]);
      m.sheenRoughness = s.sheen[1];
    }
    if (s.physical && key === 'water') {
      m.ior = 1.333;
      m.specularIntensity = 1;
      if (set?.normal && ctx.engine?.onUpdate) {
        // slow ripple drift (cosmetic; follows the current map after a quality rebuild)
        ctx.engine.onUpdate((dt) => {
          const n = m.normalMap;
          if (n) { n.offset.x += dt * 0.004; n.offset.y += dt * 0.0027; }
        }, 45);
      }
    }
    m.userData.matKey = key;
    m.userData.set = s.set || null;
    return m;
  }

  function get(key) {
    let m = cache.get(key);
    if (!m) {
      m = make(key);
      cache.set(key, m);
    }
    return m;
  }

  return {
    keys: KEYS,
    get,
    has: (key) => key in SPEC,
    /** research metadata for a key: { en, sources, confidence, note } */
    info: (key) => SPEC[SPEC[key]?.alias || key]?.info || null,
    /** texture set + physical tile of a key (for builders that need the course height etc.) */
    tile: (key) => {
      const s = SPEC[SPEC[key]?.alias || key];
      const set = s?.set && SETS[s.set];
      return set ? { tile: set.tile, rowH: set.layout?.rowH ?? null } : null;
    },
    stats,
    /** the GPU baker (debugging / verification: baker.bench() times each set with a GPU sync) */
    get baker() { return baker; },
    /** compile all generator programs in parallel, bake the shared maps; materials bake lazily on get() */
    async ready() {
      if (failed) return;
      const t0 = performance.now();
      try {
        await baker.prepare();
        if (patchState.detail) for (const id of ['d_stone', 'd_metal', 'd_wood', 'd_cloth']) detailTex(id);
        stats.gpuMs = baker.sync();
      } catch (e) {
        failed = true;
        console.warn('[mats] texture generation unavailable — flat materials', e);
      }
      stats.readyMs = performance.now() - t0;
      ctx.bus?.on?.('ready', () => baker?.releaseScratch());
      ctx.bus?.on?.('quality:change', () => this.rebuild(ctx.quality));
    },
    /** Bake every set now and wait for the GPU (verification / benchmarking). */
    bakeAll() {
      if (failed) return null;
      const t0 = performance.now();
      for (const k of KEYS) get(k);
      const cpu = performance.now() - t0;
      const gpu = baker.sync();
      return { ms: Math.round(cpu + gpu), cpuMs: Math.round(cpu), syncMs: Math.round(gpu), sets: stats.sets, MB: stats.MB };
    },
    /** Re-bake at a new quality tier (texture size, anisotropy, detail layer) and swap textures in place. */
    rebuild(nq = ctx.quality) {
      if (failed || !baker) return;
      Object.assign(q, nq);
      baker.rebake(nq.textureSize || 1024, nq.anisotropy || 4);
      shared.details.clear();
      for (const [id, r] of baker.baked) if (id.startsWith('d_')) shared.details.set(id, r);
      const detailWas = patchState.detail;
      patchState.detail = (nq.detail ?? 1) >= 1;
      for (const [key, m] of cache) {
        const s = SPEC[key];
        const set = s?.set ? baker.baked.get(s.set) : null;
        if (!set) continue;
        m.map = set.map;
        m.normalMap = set.normal;
        m.roughnessMap = m.aoMap = set.orm;
        if (set.metal) m.metalnessMap = set.orm;
        const u = m.userData.mkUniforms;
        if (u) {
          const fresh = patchUniforms(s, set);
          for (const k of Object.keys(fresh)) u[k].value = fresh[k].value;
        }
        if (detailWas !== patchState.detail) m.needsUpdate = true;
      }
      baker.releaseScratch();
    },
    dispose() {
      for (const m of cache.values()) m.dispose();
      cache.clear();
      baker?.dispose();
    },
  };
}

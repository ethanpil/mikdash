// Material library — ctx.mats.get(key) -> THREE.Material (shared instances; never mutate per-mesh).
//
// Procedural PBR: every textured material is a stock MeshStandardMaterial (MeshPhysicalMaterial for water
// and, on high/ultra, cloth sheen) with albedo + packed normal + AO/roughness(/metalness) maps baked on the
// GPU at load (gen/), in WORLD-scaled UVs (1 UV = 1 m; each texture's repeat = 1 / its physical tile size).
// An optional, chained onBeforeCompile patch (patch.js) adds world-space macro variation, per-stone
// variation and close-range micro detail; without it the materials still render correctly.
//
// Keys are stable (only ever added). Research grounding per key: `info` below, report Part VII §21/§23/§24/§26
// and Part V §13.11; reconstruction choices are logged in docs/decisions/materials*.md.
//
// API: get(key), keys, ready(), has(key), info(key) -> research metadata, tile(key) -> { tile: [w,h] m, rowH,
// courses } (e.g. the 1.1 m Herodian course height, to align modelled courses), courseAt(key, y) -> the course at
// world height y, stats (ms / MB), bakeAll(), rebuild(quality) (also on 'quality:change'), dispose(); baker (debug).
// Conventions for builders: UVs in meters (applyWorldUV); wood grain runs along U (use the *_v keys for
// posts/door boards); herodian_wall courses follow world height (v = y) — horizontal faces (wall tops) should
// use another key (ashlar_plain / paving_*); timber_bark_* = bark of one species for a modelled log (timber_rough =
// walnut), timber_pile = the long faces of a log pile (logs along U), timber_pile_end = its end faces;
// lime_whitewash = the altar, heichal_whitewash = washed ashlar.
// terrain_blend takes vertex colours as layer weights (r rock, g soil, b vegetation); olive_foliage takes instanceColor
// as a tint; embers glow (emission in the env unit convention, updated every frame); outdoor-only keys set
// userData.mkInterior = false (env compiles its room path out: MK_NO_ROOMS) — roof_plaster is one (qa-r1: every
// roof_plaster face is a building's top; the Beit HaMoked dome sat inside its hall's room box and was lit as interior).
// qa-r1: the Herodian walls darken with dust over their bottom ~0.5 m and get a contact-AO band at the foot (the floor
// beside each face from the nav grid, once it is built: footReady); the altar's lime keys carry soot and ash placed
// from the site model; metal keys' environment reflection is warmed / softened per key (SPEC.ibl).
// URL: ?matfx=0 disables the shader patch; ?mattex=0 forces flat (untextured) materials; ?matout=0 keeps env's
// interior terms in the outdoor-only materials (profiling the opt-out).
import {
  MeshStandardMaterial, MeshPhysicalMaterial, DoubleSide, Color, Vector2, Vector3, Vector4, DataTexture, RGFormat, FloatType,
  NearestFilter, ClampToEdgeWrapping, NoColorSpace,
} from 'three';
import { AMAH } from '../../core/units.js';
import { Baker } from './gen/baker.js';
import { SETS } from './gen/sets.js';
import { courseStarts } from './gen/layout.js';
import { applyPatch, envHasNoRooms } from './patch.js';

// measured F0 of gold, linear (1.0, 0.766, 0.336) -> sRGB #ffe39d (pure gold; the other grades are tints)
const GOLD = '#ffe39d';
// qa-r2: the plating (walls, floors, gate leaves) as NATURAL gold — gold with ~20 % silver, as most ancient gold was
// (reconstruction: the sources name the plating's metal, not its grade, Middot 4:1, Shekalim 4:4) — F0 ≈ linear
// (0.965, 0.815, 0.456): less saturated than pure gold, which under the Kodesh's warm interior light and the AgX look
// read as flat orange paint (on-screen b − r −97 → −79 at d3); the vessels keep pure gold ("zahav tahor")
const GOLD_PLATE = '#fbe9b4';

// the parochet's wool sheen (high/ultra, MeshPhysical): [colour (sRGB), roughness] — dark and tinted by the dyes
const SHEEN_PAROCHET = ['#4a3444', 0.55];

// the shader patch's per-stone variation of the Herodian walls: [albedo, roughness, hue] — qa-r2: hue ±1.5 % → ±0.5 %
// (with the texture's own per-stone cast it drew a patchwork of blue-grey and beige blocks; value stays ±3.5 %)
const BLOCK_HERODIAN = [0.035, 0.05, 0.01];

// macro variation presets: [albedo amp, roughness amp, scale (m), tint amp, tint (sRGB)]
const MAC = {
  wall: [0.05, 0.05, 23, 0.25, '#e4d8c3'],
  pave: [0.07, 0.10, 11, 0.30, '#d6c8ad'],
  // qa-r2: the Mount's pavement — dust and wear over 20–60 m (a 150 m period: 4 base cells per period), warm grey-brown
  // dust settling in drifts; the slabs themselves vary only ±3 % (a checkerboard from afar otherwise)
  mount: [0.045, 0.06, 150, 0.4, '#dccdb2'],
  stone: [0.05, 0.05, 9, 0.2, '#e0d4bf'],
  marble: [0.03, 0.04, 7, 0.1, '#e8e0d0'],
  lime: [0.025, 0.03, 9, 0.2, '#e8e2d6'],
  ground: [0.14, 0.05, 17, 0.4, '#b39a7c'],
  metal: [0.02, 0.02, 6, 0, '#ffffff'],
  wood: [0.06, 0.04, 5, 0.15, '#c8b79e'],
  cloth: [0.035, 0.03, 3, 0, '#ffffff'],
  ash: [0.12, 0.05, 4.5, 0.25, '#b9ae9f'],
  leaf: [0.09, 0.06, 7, 0.25, '#c9cba8'],
  earth: [0.1, 0.05, 9, 0.3, '#b8a68b'],
  terrain: [0.12, 0.05, 23, 0.3, '#aaa498'],   // neutral grey-brown drift (the warm ground tint read orange on the hills)
  // qa-r1: the altar's hand-applied lime — thicker and thinner coats, older and fresher patches, over 3–5 m
  altar: [0.06, 0.04, 5, 0.3, '#ddd6c8'],
  none: [0, 0, 10, 0, '#ffffff'],
};
// close-range detail presets: [detail set, uv scale (1/m), normal strength, albedo amp, roughness amp]
const DET = {
  stone: ['d_stone', 5, 0.55, 0.05, 0.06],
  // qa-r1: gold (sheet, vessels, relief) — the metal detail's normal / roughness noise mottled the gold in dim interiors
  gold: ['d_metal', 5, 0.16, 0.006, 0.03],
  marble: ['d_stone', 5, 0.25, 0.03, 0.04],
  lime: ['d_stone', 5, 0.35, 0.03, 0.04],
  metal: ['d_metal', 5, 0.35, 0.015, 0.08],
  polish: ['d_metal', 5, 0.08, 0.004, 0.006],   // mirror gold: the micro detail must not roughen it
  wood: ['d_wood', 3.333, 0.45, 0.06, 0.05],
  cloth: ['d_cloth', 20, 0.25, 0.03, 0.03],
};
// Herodian drafted margins (patch.js MK_COMB): [comb detail set, margin -> boss roughness step lo, hi, normal strength,
// top/bottom margin band (m: below it the strokes run vertically, above it horizontally)]
const COMB = ['d_comb', 0.64, 0.72, 0.7, 0.15];
// metal environment reflection (patch.js MK_METAL): [desaturation, blend toward the mean ambient, peak cap (× ambient)].
// Gold: blue skylight times gold's F0 is olive-green (the gates in shade read teal) and a sunlit doorway reflected in
// the Kodesh's gold clipped to white; bronze: the low tier's coarse environment drew brown / teal clouds in its doors.
const IBL = {
  none: [0, 0, 0],
  gold: [0.6, 0.18, 6],
  bronze: [0.35, 0.12, 8],
  bronzeLow: [0.5, 0.45, 4],
};
// the dust band at a Herodian wall's foot (patch.js MK_FOOT): [grime band height (m), contact-AO height (m), AO depth,
// grime amount]
const FOOT = [0.5, 0.16, 0.45, 1.0];
// the altar's soot and ash (patch.js MK_ALTAR): [soot amount, ash amount]; the three ma'arachot: [pile id, radius (m),
// strength] (piles from site.js altar.maarachah-area)
const ALTAR = [0.8, 0.65];
// the routes worn across the Mount's pavement (patch.js mkWear; paving_mount): [amount, half-width (m), lightening,
// smoothing]. The way the crowds walk from the two Chuldah gates (Middot 1:3: the people's entry and exit) round the
// soreg's south-east corner to the chel steps on the east axis (Rambam BhB 6:1) — placed from the site model
const WEAR = [1, 7, 0.06, 0.07];
const ALTAR_FIRES = [['great', 3.0, 0.9], ['incense', 1.6, 0.6], ['kiyum-haesh', 2.0, 0.6]];

// Progressive start (materials-2-fix): a cold start compiled all 30 generator programs before the world was built —
// ≈ 8 s of compile work on the HD 4600, 1.3–3.3 s of wall time (the redrawn Kodesh relief alone 1.9 s), and
// overlapping that compile with the build only stretched the build (the CPU is the limit). Now only the kinds the
// opening view needs compile before the build (the Herodian walls, the pavement, steps, the soreg, the gates' gold,
// dressed ashlar); the others compile in priority groups after 'ready', in idle time. Their sets are allocated when
// the builders ask for them — the materials hold their final textures from the start, pre-cleared to the key's flat
// look — and bake in place, a few per idle slice, when their group has compiled. In screenshot mode (?shot=1)
// every group compiles during the build and bakes at 'ready', so shots show the final textures.
const BOOT_KINDS = ['herodian', 'paving', 'stone', 'lattice', 'goldplate', 'ashlar'];
const LATER_GROUPS = [
  ['grass', 'rock', 'soil', 'leaves', 'marble', 'plaster', 'wood', 'metal', 'weave', 'water', 'detail'],
  ['whitewash', 'ash', 'iron', 'bark', 'logs', 'logend', 'char'],
  ['relief', 'hide', 'crust', 'lumps', 'rope', 'clay', 'rubble'],
];


/**
 * key: {
 *   set: texture set id (gen/sets.js) or null (flat colour); blend: [rock, soil, vegetation] layer sets instead,
 *   outdoor: never inside a room (env's interior shader terms compiled out), glow: [emissive sRGB, luminance cd/m²]
 *     (emission mask = the set's albedo alpha), comb: comb-chisel detail on the drafted margins (Herodian),
 *   color: sRGB multiplier (metal F0 for metals; white for colour-in-texture sets), rough / metal: scalars
 *     (multipliers when the set has an ORM map), normal: normalScale,
 *   macro / detail: presets above, block: [albedo, roughness, hue] amplitudes (masonry/sheet sets),
 *   physical, sheen: [colour, roughness] (high/ultra), side, alphaTest,
 *   foot: dust band and contact AO at a wall's foot (qa-r1), altar: the altar's soot / ash masks (qa-r1),
 *   wear: the Mount's worn routes (qa-r2, patch.js mkWear),
 *   ibl: metal environment-reflection treatment (IBL presets), low: { rough, ibl, block } overrides on the low tier
 *     (rough and block are multipliers),
 *   flat: [colour, roughness, metalness] used when texture generation is unavailable,
 *   info: { en, he, note, sources, confidence }
 * }
 */
export const SPEC = {
  // ----------------------------------------------------------------- stone
  herodian_wall: {
    set: 'herodian', macro: MAC.wall, block: BLOCK_HERODIAN, detail: DET.stone, comb: true, foot: true, flat: ['#ddd6c6', 0.6, 0],
    info: {
      en: 'Herodian marble ashlar — stones of white, blue-green and veined marble, each stone its own ("the stones differ in appearance one from another", Rashi), one course set out and one drawn in, left unplastered ("like the waves of the sea"); drafted, comb-dressed margins and a raised, pointed boss',
      sources: ['Bava Batra 4a', 'Sukkah 51b with Rashi', 'Part VII §21 #1, §25', 'Part V §13.11'],
      confidence: 'derived', note: 'course height 1.1 m, block lengths 2–5 m, the marbles\' shares, margin/boss dimensions and dressing, the dust at the foot: reconstruction',
    },
  },
  herodian_wall_inner: {
    set: 'herodian_inner', macro: MAC.wall, block: BLOCK_HERODIAN, detail: DET.stone, comb: true, foot: true, flat: ['#ddd6c6', 0.65, 0],
    info: {
      en: 'The same marble ashlar on the inner / court faces — drafted, combed margins round a lower, finer boss',
      sources: ['Bava Batra 4a', 'Sukkah 51b with Rashi'], confidence: 'reconstruction', note: 'face finish of inner faces unattested',
    },
  },
  marble_white: {
    set: 'marble_white', macro: MAC.marble, detail: DET.marble, flat: ['#e9e4d8', 0.45, 0],
    info: { en: 'Shayish — white marble (monolithic: columns, tables, slabs)', sources: ['Bava Batra 4a', 'Shekalim 6:4', 'Part VII §26'], confidence: 'explicit' },
  },
  marble_kochla: {
    set: 'marble_kochla', macro: MAC.marble, detail: DET.marble, flat: ['#c4cbc9', 0.45, 0],
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
    set: 'paving_mount', macro: MAC.mount, block: [0.015, 0.06, 0.008], low: { block: 0.5 }, detail: DET.stone, wear: true, flat: ['#cfc4ad', 0.8, 0],
    info: {
      en: 'Har HaBayit pavement — large weathered pale marble slabs in rows',
      sources: ['Ezrat Kohanim I p.184 (Part X)'], confidence: 'reconstruction', note: 'slab sizes (rows 1.25 m) reconstruction',
    },
  },
  paving_azarah: {
    set: 'paving_azarah', macro: MAC.pave, block: [0.05, 0.08, 0.02], low: { block: 0.5 }, detail: DET.marble, flat: ['#d6cdbd', 0.55, 0],
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
    set: 'whitewash', macro: MAC.altar, detail: DET.lime, altar: true, flat: ['#ebe6db', 0.85, 0],
    info: {
      en: 'The altar (and kevesh): whole rounded field-stones in a lime/lead/pitch slurry, whitewashed with lime twice a year (Pesach, Sukkot) — no iron trowel; Rebbi: wiped with a cloth every Erev Shabbat. The limed mass swells over the stones, its skin finely crazed; soot toward the top and over each ma\'arachah, ash along the top edges and corners. (The Heichal, washed once a year at Pesach, is heichal_whitewash.)',
      sources: ['Middot 3:4', 'Zevachim 54a', 'Rambam BhB 1:14–16, 2:16', 'Tamid 2:4–5'], confidence: 'derived', note: 'stone sizes / lime thickness, undulation, crazing, soot and ash placement: reconstruction',
    },
  },
  sikra_red: {
    set: 'sikra', macro: MAC.lime, detail: DET.lime, altar: true, flat: ['#8f2a1d', 0.8, 0],
    info: { en: 'Chut hasikra — red ochre line girding the altar at mid-height', sources: ['Middot 3:1', 'Zevachim 53a'], confidence: 'explicit' },
  },
  plaster: {
    set: 'plaster', macro: MAC.lime, detail: DET.lime, flat: ['#e8e2d4', 0.9, 0],
    info: { en: 'Lime plaster (sid)', sources: ['Part VII §21'], confidence: 'reconstruction' },
  },
  bedrock: {
    // MAC.stone (world-4): the ground preset's warm-brown tint (0.4) darkened the Even Shetiyah against the gold floor
    set: 'bedrock', macro: MAC.stone, detail: DET.stone, flat: ['#d2c6ab', 0.95, 0],
    info: { en: 'Bare bedrock — the Even Shetiyah, rising 3 etzba\'ot above the floor', sources: ['Yoma 5:2, 53b', 'Part V §13.8'], confidence: 'derived' },
  },
  terrain_soil: {
    set: 'terrain_soil', outdoor: true, macro: MAC.ground, detail: DET.stone, flat: ['#8c5a3c', 1.0, 0],
    info: { en: 'Terra rossa soil between the rocks', sources: ['regional geology'], confidence: 'reconstruction' },
  },
  terrain_rock: {
    set: 'terrain_rock', outdoor: true, macro: MAC.ground, detail: DET.stone, flat: ['#a8977a', 0.95, 0],
    info: { en: 'Jerusalem limestone outcrops (karst)', sources: ['regional geology'], confidence: 'reconstruction' },
  },
  ash: {
    set: 'ash', macro: MAC.ash, flat: ['#8f8a84', 1.0, 0],
    info: { en: 'Wood ash — the tapuach and Beit HaDeshen', sources: ['Tamid 1:4, 2:2'], confidence: 'derived' },
  },
  // ----------------------------------------------------------------- metal (colour = F0, sRGB)
  gold_plate: {
    set: 'goldplate', color: GOLD_PLATE, rough: 1, metal: 1, macro: MAC.metal, block: [0.005, 0, 0.002], detail: DET.gold, ibl: IBL.gold,
    flat: ['#d4a640', 0.22, 1],
    info: {
      en: 'Beaten gold sheets (rikuei zahav) over walls and gate doors — visible seams, hammer dishing',
      sources: ['Middot 2:3, 4:1', 'Shekalim 4:4', 'Part VII §24'], confidence: 'derived', note: 'sheet size 1 × 1.5–3 amot, hammering (roughness 0.25–0.4 blow by blow) and waviness, the grade (natural gold, ~20 % silver): reconstruction',
    },
  },
  gold_relief: {
    set: 'relief', color: GOLD_PLATE, metal: 1, macro: MAC.metal, detail: DET.gold, ibl: IBL.gold, flat: ['#d4a640', 0.25, 1],
    info: {
      en: 'Kodesh walls: gold fitted evenly over carved keruvim (children with wings rising upward, in pairs facing each palm), palm trees and open flowers — a modelled bas-relief up to ~2.3 cm deep',
      sources: ['Middot 4:1', 'Yoma 54a (keruvim d\'tzurta)', '1 Melachim 6:29', 'Sukkah 5b', 'Chagigah 13b', 'Shemot 25:20', 'Part VII §21 #20'],
      confidence: 'reconstruction', note: 'motif drawing, scale and arrangement, the hammered finish and the grade of the gold (natural gold, ~20 % silver) are reconstruction',
    },
  },
  gold_green: {
    set: 'vessel', color: '#f0e6a6', metal: 1, macro: MAC.metal, detail: DET.gold, ibl: IBL.gold, flat: ['#c8b04a', 0.25, 1],
    info: { en: 'Greenish gold — the daily machtah', sources: ['Yoma 44b–45a', 'Part VII §24'], confidence: 'derived' },
  },
  gold_red: {
    set: 'vessel', color: '#fbbd90', metal: 1, macro: MAC.metal, detail: DET.gold, ibl: IBL.gold, flat: ['#c9803a', 0.25, 1],
    info: { en: 'Zahav parvayim — red gold "like the blood of bulls" (Yom Kippur machtah)', sources: ['Yoma 44b–45a'], confidence: 'derived' },
  },
  gold_vessel: {
    set: 'vessel', color: GOLD, metal: 1, rough: 0.9, macro: MAC.metal, detail: DET.gold, ibl: IBL.gold, flat: ['#e0b34c', 0.18, 1],
    info: { en: 'Gold service vessels (menorah, table, incense altar, cups)', sources: ['Part VII §24'], confidence: 'derived' },
  },
  bronze_corinthian: {
    set: 'bronze', color: '#f4d29e', metal: 1, macro: MAC.metal, detail: DET.metal, ibl: IBL.bronze, flat: ['#c99a55', 0.28, 1],
    // low: the coarse environment of the low tier reflected as brown / teal clouds in the polished leaves — rougher there,
    // and its reflection pulled toward the warm mean ambient
    low: { rough: 1.8, ibl: IBL.bronzeLow },
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
    set: 'silver', color: '#f6f3ec', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#cfd2d6', 0.2, 1],
    info: { en: 'Silver — table W of the ramp, machtah, trumpets, Pesach basins: in daily use, lightly tarnished', sources: ['Shekalim 6:4', 'Tamid 1:4', 'Part VII §24'], confidence: 'derived', note: 'tarnish and roughness: reconstruction' },
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
    set: 'bark_walnut', macro: MAC.wood, detail: DET.wood, flat: ['#6e5137', 0.85, 0],
    info: {
      en: 'Rough timber / firewood bark — walnut (one species per log: use timber_bark_fig / _walnut / _pine per log for the altar\'s mix of fig, walnut and oil-tree; never olive or vine)',
      sources: ['Tamid 2:3'], confidence: 'explicit', note: 'species identification of etz shemen as pine follows the common reading; bark looks reconstruction',
    },
  },
  // ----------------------------------------------------------------- textiles
  linen_white: {
    set: 'linen', side: DoubleSide, macro: MAC.cloth, detail: DET.cloth, sheen: ['#ffffff', 0.55], flat: ['#f1ede2', 0.9, 0],
    info: { en: 'Shesh — fine six-ply white linen, plain weave', sources: ['Part VIII §34', 'Part VII §23'], confidence: 'derived', note: 'thread count reconstruction' },
  },
  parochet: {
    // qa-r2: every cord twisted of the four materials (an even heathered mix, no stripes) with a soft wool sheen on
    // high/ultra — dark and dye-tinted, so it lifts the folds at grazing angles without washing the cloth to pastel
    // (qa-r1's pale mauve lobe did)
    set: 'parochet', side: DoubleSide, macro: MAC.cloth, detail: DET.cloth, sheen: SHEEN_PAROCHET, flat: ['#4e2840', 0.85, 0],
    info: {
      en: 'Parochet — a tefach thick, woven on 72 cords of 24 threads each: six each of techelet (sky-blue wool), argaman (red-purple), tola\'at shani (crimson) and shesh (linen), twisted together, so the four colours mix evenly in every cord; 2/2 twill',
      sources: ['Shekalim 8:5', 'Yoma 71b–72b', 'Rambam Klei HaMikdash 7:16, 8:13–15', 'Part V §13.7', 'Part VII §23'],
      confidence: 'derived', note: 'cord size (8 mm), twill, twist and dye tones: reconstruction; figures not attested and not drawn; the two faces are not differentiated (one texture both sides)',
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
  // qa-r1: an outdoor-only key of its own (was an alias of roof_tile): every face that uses it is a building's top, and
  // the Beit HaMoked dome, deep inside its hall's room box, was darkened by env as an interior surface (near-black)
  roof_plaster: {
    set: 'roof', outdoor: true, macro: MAC.lime, detail: DET.lime, flat: ['#c9c0ae', 0.9, 0],
    info: {
      en: 'Roof surface — ma\'azivah, the plaster / lime-concrete roof fill, and the plastered domes (Beit HaMoked); outdoor only',
      sources: ['Middot 4:6', 'Middot 1:6', 'Part V §13.11'], confidence: 'derived',
    },
  },
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
      en: 'A stacked pile of altar logs as one surface — the long faces, logs running along U (rows of ~12–16 cm fig, walnut and pine logs, one species per log, some split); use timber_pile_end on the faces where the logs end',
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

  // ----------------------------------------------------------------- materials-2 keys
  terrain_blend: {
    blend: ['tb_rock', 'tb_soil', 'tb_veg'], outdoor: true, macro: MAC.terrain, detail: DET.stone, flat: ['#8d7c68', 0.95, 0],
    info: {
      en: 'The ground of the hills round the Mount, blended per vertex (colour r = rock, g = soil, b = vegetation), early November: grey limestone; the open hillside of stony brown terra rossa with clumped dry grass and grey dwarf-shrub cushions; cultivated ground of stubble rows over furrowed soil with a little new green',
      sources: ['regional geology and vegetation'], confidence: 'reconstruction',
      note: 'layer edges follow world-space noise and the layers\' own heights (rock proud of the soil, grass in the hollows) and widen with distance',
    },
  },
  olive_foliage: {
    set: 'olive_leaves', outdoor: true, macro: MAC.leaf, flat: ['#6c7462', 0.6, 0],
    info: { en: 'Olive foliage — narrow lanceolate leaves in sprays, dark grey-green and glossy above, a little paler below (tint per tree by instanceColor)', sources: ['regional vegetation'], confidence: 'reconstruction' },
  },
  olive_foliage_card: {
    set: 'olive_card', outdoor: true, side: DoubleSide, alphaTest: 0.5, macro: MAC.leaf, flat: ['#6c7462', 0.6, 0],
    info: { en: 'Olive leaf-cluster card (alpha-tested sprays) for near crowns', sources: ['regional vegetation'], confidence: 'reconstruction' },
  },
  roof_earth: {
    set: 'roof_earth', outdoor: true, macro: MAC.earth, detail: DET.stone, flat: ['#8a7c6b', 0.95, 0],
    info: { en: 'City house roofs of rolled earth with lime worked in (rolled flat, straw flecks, shrinkage cracks)', sources: ['period building practice'], confidence: 'reconstruction' },
  },
  house_rubble: {
    set: 'rubble', outdoor: true, macro: MAC.wall, detail: DET.stone, flat: ['#a59d8e', 0.92, 0],
    info: { en: 'City house walls of roughly coursed field-stone rubble in mud-lime mortar (rounded stones standing proud, mortar raked back)', sources: ['period building practice'], confidence: 'reconstruction' },
  },
  terracotta: {
    set: 'terracotta', macro: MAC.stone, detail: DET.stone, flat: ['#9c6c54', 0.82, 0],
    info: { en: 'Fired clay — Herodian oil lamps, jugs (wheel striations, slip, firing clouds, grit)', sources: ['period pottery'], confidence: 'reconstruction' },
  },
  leather: {
    set: 'hide', macro: MAC.cloth, detail: DET.cloth, flat: ['#cdb79c', 0.6, 0],
    info: { en: 'Hides of the offerings being salted (flesh side: fibrous membrane, fat, coarse salt) — Lishkat HaParvah', sources: ['Middot 5:3'], confidence: 'derived', note: 'appearance: reconstruction' },
  },
  timber_charred: {
    set: 'char', macro: MAC.wood, detail: DET.wood, flat: ['#1c1a18', 0.6, 0],
    info: { en: 'Charred wood (alligator char in rectangular checks along the grain, satin black, ash in the cracks)', sources: ['Tamid 2:3'], confidence: 'reconstruction' },
  },
  embers: {
    set: 'embers', glow: ['#ff6a1f', 1400], macro: MAC.ash, flat: ['#5a3a2a', 0.9, 0],
    info: {
      en: 'A coal bed under ash — clustered charcoal lumps, glowing cracks (emission in the env unit convention: cd/m² × env.preExposure, with fx\'s fire gain)',
      sources: ['Tamid 1:4, 2:2'], confidence: 'reconstruction', note: 'coal luminance ~1400 cd/m² at the brightest cracks, as fx coal beds (2000 cd/m² mean bed)',
    },
  },
  soot: {
    set: 'soot', macro: MAC.none, flat: ['#1f1c1a', 0.95, 0],
    info: { en: 'Soot crust (fire-blackened pot bottoms)', sources: [], confidence: 'reconstruction' },
  },
  lime_whitewash_worn: {
    set: 'whitewash_worn', macro: MAC.altar, detail: DET.lime, altar: true, flat: ['#e6e1d6', 0.72, 0],
    info: { en: 'The altar\'s lime on its walking surfaces (kevesh, sovev, walkway): stones buried and worn down, cloth-wipe strokes, darker glossier bare-foot lanes along V, hairline crazing, patched repairs', sources: ['Middot 3:3–4'], confidence: 'derived', note: 'wear: reconstruction' },
  },
  lime_whitewash_soot: {
    set: 'whitewash_soot', macro: MAC.altar, detail: DET.lime, altar: true, flat: ['#d6d0c6', 0.88, 0],
    info: { en: 'The altar\'s lime near the pyre: faint soot (washed twice a year, wiped weekly)', sources: ['Middot 3:4', 'Zevachim 54a'], confidence: 'reconstruction' },
  },
  lime_whitewash_stained: {
    set: 'whitewash_stained', macro: MAC.altar, detail: DET.lime, altar: true, flat: ['#ddcfc5', 0.88, 0],
    info: { en: 'The altar\'s lime where blood is poured and placed (the southern and western yesod, the NE and SW corners below the line, the horns): dark red-brown runs and patches, partly washed out (wiped every Erev Shabbat)', sources: ['Zevachim 53a', 'Tamid 4:1', 'Middot 3:1, 3:4'], confidence: 'reconstruction', note: 'strength of the stains: reconstruction' },
  },
  timber_split: {
    set: 'split_wood', macro: MAC.wood, detail: DET.wood, flat: ['#b39878', 0.82, 0],
    info: { en: 'Riven (split) wood faces — the two gizrei etzim: torn ridges and splinters along the grain', sources: ['Yoma 2:5', 'Zevachim 62b'], confidence: 'reconstruction' },
  },
  timber_weathered: {
    set: 'weathered', macro: MAC.wood, detail: DET.wood, flat: ['#857c6e', 0.86, 0],
    info: { en: 'Sun-greyed timber of a working machine (the muchni), grain along U', sources: ['Yoma 37a'], confidence: 'reconstruction' },
  },
  timber_weathered_v: {
    set: 'weathered_v', macro: MAC.wood, detail: DET.wood, flat: ['#857c6e', 0.86, 0],
    info: { en: 'Weathered timber, grain along V (posts)', sources: ['Yoma 37a'], confidence: 'reconstruction' },
  },
  rope: {
    set: 'rope', macro: MAC.cloth, detail: DET.cloth, flat: ['#9a8566', 0.9, 0],
    info: { en: 'Hemp rope (laid strands)', sources: [], confidence: 'reconstruction' },
  },
  copper_worn: {
    set: 'copperworn', color: '#f6c6aa', metal: 1, macro: MAC.metal, detail: DET.metal, flat: ['#6b4535', 0.45, 1],
    info: { en: 'Working kitchen copper — hammered, an even brown oxide film rubbed bright along the ridges between the hammer dishes', sources: ['Zevachim 11:7–8 (copper pots scoured)'], confidence: 'reconstruction' },
  },
  gold_polished: {
    set: 'goldpolish', color: GOLD, metal: 1, macro: MAC.metal, detail: DET.polish, flat: ['#e0b34c', 0.07, 1],
    info: { en: 'Mirror-polished gold (roughness ≈ 0.05–0.09) — Helena\'s nivreshet', sources: ['Yoma 37b'], confidence: 'derived', note: 'polish: reconstruction' },
  },
  gold_plate_door: {
    set: 'golddoor', color: GOLD_PLATE, metal: 1, rough: 0.9, macro: MAC.metal, detail: DET.gold, ibl: IBL.gold, flat: ['#d4a640', 0.25, 1],
    info: { en: 'Beaten gold over a door leaf — one sheet per panel, no seams; hammer dishing and waviness', sources: ['Middot 2:3, 4:1'], confidence: 'derived', note: 'the seamless sheet is reconstruction (the plating of the leaves is attested)' },
  },
  bread: {
    set: 'bread', macro: MAC.none, flat: ['#d8b27a', 0.8, 0],
    info: { en: 'Unleavened loaf crust (the showbread): baked pale with toasted spots, flour dust', sources: ['Menachot 5:1', 'Menachot 11:1–2'], confidence: 'derived', note: 'colour and toasting: reconstruction' },
  },
  frankincense: {
    set: 'frankincense', macro: MAC.none, flat: ['#efe5c8', 0.6, 0],
    info: { en: 'Frankincense (levonah) — irregular pale resin tears, translucent at their thin edges, white bloom, glassy where broken', sources: ['Vayikra 24:7', 'Menachot 11:5'], confidence: 'derived' },
  },

  // ----------------------------------------------------------------- materials-2-fix keys
  // the same Herodian walls with course heights of 1.00–1.20 m from a course table: builders that model the set-out
  // courses from ctx.mats.courseAt(key, y) switch to these keys (the 1.1 m keys stay for the current geometry)
  herodian_wall_courses: {
    set: 'herodian_c', macro: MAC.wall, block: BLOCK_HERODIAN, detail: DET.stone, comb: true, foot: true, flat: ['#ddd6c6', 0.6, 0],
    info: {
      en: 'herodian_wall with course heights varying 1.00–1.20 m (a course table: ctx.mats.courseAt(key, y)), the marble chosen stone by stone',
      sources: ['Bava Batra 4a', 'Part V §13.11'], confidence: 'reconstruction', note: 'course heights: reconstruction',
    },
  },
  herodian_wall_inner_courses: {
    set: 'herodian_inner_c', macro: MAC.wall, block: BLOCK_HERODIAN, detail: DET.stone, comb: true, foot: true, flat: ['#ddd6c6', 0.65, 0],
    info: { en: 'herodian_wall_inner on the same course table as herodian_wall_courses', sources: ['Bava Batra 4a', 'Sukkah 51b with Rashi'], confidence: 'reconstruction' },
  },
  // bark of one species per log (Tamid 2:3: fig, walnut and oil-tree, never olive or vine) and the olive groves' trunks
  timber_bark_fig: {
    set: 'bark_fig', macro: MAC.wood, detail: DET.wood, flat: ['#837e73', 0.75, 0],
    info: { en: 'Fig bark — smooth silvery grey, fine wrinkles, lenticels (firewood, Tamid 2:3)', sources: ['Tamid 2:3'], confidence: 'derived', note: 'bark look: reconstruction' },
  },
  timber_bark_walnut: { alias: 'timber_rough' },
  timber_bark_pine: {
    set: 'bark_pine', macro: MAC.wood, detail: DET.wood, flat: ['#6a5848', 0.86, 0],
    info: { en: 'Oil-tree (Aleppo pine) bark — long grey-brown plates over red-brown fissures (firewood, Tamid 2:3)', sources: ['Tamid 2:3'], confidence: 'derived', note: 'etz shemen as pine: the common reading; bark look reconstruction' },
  },
  olive_bark: {
    set: 'bark_olive', outdoor: true, macro: MAC.wood, detail: DET.wood, flat: ['#77736a', 0.86, 0],
    info: { en: 'Old olive trunks — grey bark, twisted fissures at a slant, lichen (the groves; olive wood is never firewood for the altar)', sources: ['regional vegetation', 'Tamid 2:3'], confidence: 'reconstruction' },
  },
  // ----------------------------------------------------------------- world-4 keys
  // weathered lead run into iron work (Bilgah's ring leaded fast to its plate): the silver set's maps (white albedo,
  // tarnish) tinted to lead's dull blue-grey and roughened — no new texture set and the same shader program as silver
  lead: {
    set: 'silver', color: '#6c7075', metal: 1, rough: 3.6, macro: MAC.metal, detail: DET.metal, flat: ['#6c7075', 0.7, 1],
    info: { en: 'Lead, weathered dull grey — run molten into a joint to fix iron fast (Bilgah\'s ring, Sukkah 5:8)', sources: ['Sukkah 5:8', 'Rashi Sukkah 56a'], confidence: 'reconstruction' },
  },
};

const KEYS = Object.keys(SPEC);

function warnOnce(store, key, ...args) {
  if (store.has(key)) return;
  store.add(key);
  console.warn(...args);
}

const COURSE_TYPES = ['shayish', 'kochla', 'marmara'];

/** the course at world height y (m) of a set with a masonry layout: { index, y0, h, setOut, type } */
function courseAtSet(set, y) {
  const L = set.layout;
  const H = set.tile[1];
  const heights = L.heights || Array.from({ length: Math.round(H / L.rowH) }, () => H / Math.round(H / L.rowH));
  const y0s = courseStarts(heights);
  const t = Math.floor(y / H);
  const yt = y - t * H;
  let r = 0;
  while (r < heights.length - 1 && yt >= y0s[r + 1] - 1e-9) r++;
  const [type, flag] = (L.rowType || (() => [0, 0]))(r);
  return { index: t * heights.length + r, y0: t * H + y0s[r], h: heights[r], setOut: flag === 1, type: COURSE_TYPES[type] || null };
}

export function createMaterialLibrary(ctx) {
  const q = ctx.quality || {};
  const raw = ctx.params?.raw;
  const warned = new Set();
  // outdoor: false (?matout=0, or setOutdoorOpt(false)) keeps env's interior terms everywhere (profiling the opt-out)
  const patchState = { enabled: raw?.get?.('matfx') !== '0', detail: (q.detail ?? 1) >= 1, outdoor: raw?.get?.('matout') !== '0' };
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
  // per-tier overrides (SPEC.low): the low tier is detail 0
  const isLow = () => (q.detail ?? 1) < 1;
  const lowOf = (s, k, dflt) => (isLow() && s.low?.[k] != null ? s.low[k] : dflt);
  const iblOf = (s) => lowOf(s, 'ibl', s.ibl || IBL.none);
  // the wall-foot floor map and its fade-in (patch.js MK_FOOT): one set of uniform objects shared by every foot key
  const footU = {
    mkFootMap: { value: null },
    mkFoot: { value: new Vector4(0, 0, 1, 1) },
    mkFootK: { value: new Vector4(0, FOOT[0], FOOT[1], FOOT[2]) },
    mkFootG: { value: new Vector2(FOOT[3], 0) },
  };
  let altarU = null;
  const t0Lib = performance.now();
  let loading = null;
  const shotMode = raw?.get?.('shot') === '1';
  // the flat look of a set (from the first key that uses it): its pre-clear before the bake
  const flatFor = (id) => {
    const s = Object.values(SPEC).find((x) => x.set === id) || Object.values(SPEC).find((x) => x.blend?.includes(id));
    const [c, r, mt] = s?.flat || ['#808080', 0.8, 0];
    return [new Color(SETS[id]?.metal ? '#f2f2f2' : c), Math.min(1, r / (s?.rough ?? 1)), mt];
  };
  const B = () => baker?.stats || {};
  const stats = {
    readyMs: 0, gpuMs: 0, loadedMs: 0, waitMs: 0,
    get flushMs() { return Math.round(B().flushMs || 0); },
    get laterMs() { return Math.round(B().laterMs || 0); },
    get compileMs() { return Math.round(B().compileMs || 0); },
    get basisMs() { return Math.round(B().basisMs || 0); },
    get bakeMs() { return Math.round(B().bakeMs || 0); },
    get sets() { return B().sets || 0; },
    /** perf-fix-2: set bakes so far; rises whenever a material's textures were (re-)drawn in place */
    get bakes() { return B().bakes || 0; },
    get kinds() { return B().kinds || 0; },
    get restMs() { return Math.round(B().restMs || 0); },
    /** GPU memory of the baked sets + basis maps */
    get bytes() { return (B().bytes || 0) + (B().basisBytes || 0); },
    get MB() { return +(((B().bytes || 0) + (B().basisBytes || 0)) / 1048576).toFixed(1); },
    toJSON() {
      const { readyMs, gpuMs, compileMs, basisMs, bakeMs, sets, kinds, restMs, MB } = this;
      return {
        readyMs: Math.round(readyMs), gpuMs: Math.round(gpuMs), compileMs, basisMs, bakeMs, sets, kinds, restMs, MB,
        loadedMs: Math.round(this.loadedMs), waitMs: Math.round(this.waitMs), flushMs: this.flushMs, laterMs: this.laterMs,
      };
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

  /**
   * the altar's frame in world space for patch.js MK_ALTAR, from the site model: centre and half-width of the 28-square,
   * its top, the court floor, the chut hasikra, and the three ma'arachot (site.js altar.maarachah-area piles); shared by
   * the lime keys. Without the altar elements the amounts are 0 (no soot, no ash).
   */
  function altarUniforms() {
    if (altarU) return altarU;
    const u = {
      mkAlt0: { value: new Vector4(0, 0, 1, -1e4) }, mkAlt1: { value: new Vector4(0, -1e4, 0, 0) },
      mkAltF0: { value: new Vector4(0, 0, 1, 0) }, mkAltF1: { value: new Vector4(0, 0, 1, 0) }, mkAltF2: { value: new Vector4(0, 0, 1, 0) },
    };
    const el = (id) => { try { return ctx.elOpt?.(id) || null; } catch { return null; } };
    const top = el('altar.top'), body = el('altar.body'), sik = el('altar.chut-hasikra'), maar = el('altar.maarachah-area');
    if (top?.box && body?.box) {
      const b = top.box;
      u.mkAlt0.value.set(((b.min[0] + b.max[0]) / 2) * AMAH, -((b.min[1] + b.max[1]) / 2) * AMAH, ((b.max[0] - b.min[0]) / 2) * AMAH, b.max[2] * AMAH);
      const zSik = sik?.params?.z ?? (body.box.min[2] + body.box.max[2]) / 2;
      u.mkAlt1.value.set(body.box.min[2] * AMAH, zSik * AMAH, ALTAR[0], ALTAR[1]);
      const piles = maar?.params?.piles || [];
      ALTAR_FIRES.forEach(([id, r, k], i) => {
        const pb = piles.find((x) => x.id === id)?.box;
        if (pb) u[`mkAltF${i}`].value.set(((pb.min[0] + pb.max[0]) / 2) * AMAH, -((pb.min[1] + pb.max[1]) / 2) * AMAH, r, k);
      });
    }
    altarU = u;
    return u;
  }

  /**
   * The routes worn across the Mount (patch.js mkWear), world x, z: each Chuldah passage's exit onto the Mount
   * (site.js context.chuldah.tunnel-*.params.exit) to a point 8 amot outside the soreg's south-east corner, then north to
   * the foot of the chel steps (mount.chel.steps.params.foot). Without the elements the amount is 0.
   */
  let wearU = null;
  function wearUniforms() {
    if (wearU) return wearU;
    const u = {
      mkWear: { value: new Vector4(0, WEAR[1], WEAR[2], WEAR[3]) },
      mkWearA: { value: new Vector4() }, mkWearB: { value: new Vector4() }, mkWearC: { value: new Vector4() },
    };
    const el = (id) => { try { return ctx.elOpt?.(id) || null; } catch { return null; } };
    const ew = el('context.chuldah.tunnel-w')?.params?.exit, ee = el('context.chuldah.tunnel-e')?.params?.exit;
    const foot = el('mount.chel.steps')?.params?.foot, path = el('mount.soreg')?.params?.path;
    if (ew && ee && foot && path?.length) {
      const se = path.reduce((a, p) => (p[0] - p[1] > a[0] - a[1] ? p : a));
      const c = [se[0] + 8, se[1] - 8];
      const W = (a, b) => new Vector4(a[0] * AMAH, -a[1] * AMAH, b[0] * AMAH, -b[1] * AMAH);
      u.mkWearA.value.copy(W(ew, c));
      u.mkWearB.value.copy(W(ee, c));
      u.mkWearC.value.copy(W(c, foot));
      u.mkWear.value.x = WEAR[0];
    }
    wearU = u;
    return u;
  }

  function patchUniforms(s, set) {
    const mac = s.macro || MAC.none;
    const det = s.detail;
    const blk = (set?.layout && s.block) || null;
    const blkA = blk ? blk[0] * lowOf(s, 'block', 1) : 0;
    const ibl = iblOf(s);
    const dtex = det && patchState.detail ? detailTex(det[0]) : null;
    const ctex = s.comb && patchState.detail ? detailTex(COMB[0]) : null;
    const lay = set?.layout;
    return {
      mkMacroMap: { value: macroTex() },
      mkMacro: { value: new Vector4(mac[0], mac[1], 1 / mac[2], mac[3]) },
      mkTint: { value: new Color(mac[4]) },
      mkBlock: { value: blk ? new Vector4(lay.q, lay.rowH, lay.dMax, blkA) : new Vector4(1, lay?.rowH || 1, 1, 0) },
      mkBlockR: { value: new Vector2(blk ? blk[1] : 0, blk ? blk[2] || 0 : 0) },
      mkDetailMap: { value: dtex },
      mkDetail: { value: dtex ? new Vector4(det[1], det[2], det[3], det[4]) : new Vector4(0, 0, 0, 0) },
      mkDetailFade: { value: new Vector2(2.5, 12) },
      mkCombMap: { value: ctex },
      mkComb: { value: new Vector4(COMB[1], COMB[2], ctex ? COMB[3] : 0, COMB[4]) },
      mkCourseMap: { value: lay?.courseTex || null },
      mkCourse: { value: new Vector2(set?.tile?.[1] || 1, lay?.courseN || 1) },
      mkMetal: { value: new Vector4(ibl[0], ibl[1], ibl[2], 0) },
      // (every patched material carries the route-wear uniforms — the program is shared — zero unless it has routes)
      ...(s.wear ? wearUniforms() : {
        mkWear: { value: new Vector4(0, 1, 0, 0) }, mkWearA: { value: new Vector4() }, mkWearB: { value: new Vector4() }, mkWearC: { value: new Vector4() },
      }),
      ...(s.foot ? footU : {}),
      ...(s.altar ? altarUniforms() : {}),
    };
  }

  /** outdoor-only: env's room path compiled out (MK_NO_ROOMS — env sets it too, on its scene traversals) */
  function markOutdoor(m, on) {
    if (on) {
      m.userData.mkInterior = false;
      if (envHasNoRooms()) m.defines = { ...(m.defines || {}), MK_NO_ROOMS: '' };
    } else {
      delete m.userData.mkInterior;
      if (m.defines && 'MK_NO_ROOMS' in m.defines) {
        const d = { ...m.defines };
        delete d.MK_NO_ROOMS;
        m.defines = d;
      }
    }
  }

  function make(key) {
    const s = SPEC[key];
    if (!s) {
      warnOnce(warned, `key:${key}`, `[mats] unknown material "${key}" — using debug`);
      return get('debug');
    }
    if (s.alias) return get(s.alias);
    if (s.blend) return makeBlend(key, s);
    const set = getSet(s.set);
    const uvSwap = !!SETS[s.set]?.rotOf;
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
      m.roughness = (s.rough ?? 1) * lowOf(s, 'rough', 1);
      if (set.metal) {
        m.metalnessMap = set.orm;
        m.metalness = s.metal ?? 1;
      } else {
        m.metalness = s.metal ?? 0;
      }
      if (patchState.enabled || uvSwap) {
        const uniforms = patchUniforms(s, set);
        m.userData.mkUniforms = uniforms;
        applyPatch(m, uniforms, patchState, {
          glow: !!s.glow, outdoor: !!s.outdoor, comb: !!s.comb, courses: !!set.layout?.courseTex, uvSwap,
          foot: !!s.foot, altar: !!s.altar, metal: !!set.metal,
        });
      }
      if (s.glow) glowing(m, s.glow);
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
    if (s.outdoor && patchState.outdoor) markOutdoor(m, true);
    return m;
  }

  /**
   * Emission whose mask is the set's albedo alpha: emissive colour × luminance (cd/m²) × the fire emission scale —
   * env.preExposure × env.fireScale, with fx's fire gain (a reference flame core is held at 1.8 × the display cap
   * once the eye adapts to the fire; fx's `emissionScale` is used when render exposes it).
   */
  function glowing(m, [color, L]) {
    m.emissive.set(color);
    m.emissiveIntensity = 0;
    if (!ctx.engine?.onUpdate) return;
    ctx.engine.onUpdate(() => {
      const env = ctx.env || {};
      const fx = ctx.fx?.emissionScale;
      let k;
      if (Number.isFinite(fx)) k = fx;
      else {
        const P = (env.preExposure > 0 ? env.preExposure : 1) * (Number.isFinite(env.fireScale) ? env.fireScale : 1);
        // fx: gain = min(1, 1.8 × cap / (2.5e4 cd/m² × P)), cap = display cap (post 3, low 0.75) / exposure
        const cap = (ctx.quality?.post ? 3 : 0.75) / Math.max(env.exposure || 1, 1e-6);
        k = P * Math.min(1, (1.8 * cap) / (2.5e4 * P));
      }
      m.emissiveIntensity = L * k;
    }, 55);
  }

  /** terrain_blend: three layer sets (rock, soil, vegetation) mixed by vertex colour weights (patch.js). */
  function blendUniforms(sets) {
    return {
      tbA1: { value: sets[1].map }, tbA2: { value: sets[2].map },
      tbN1: { value: sets[1].normal }, tbN2: { value: sets[2].normal },
      tbRep: { value: new Vector3(1 / sets[0].tile[0], 1 / sets[1].tile[0], 1 / sets[2].tile[0]) },
      // height influence, edge-noise amplitude, blend band, edge-noise frequency (1/m: features of ~3-8 m)
      tbK: { value: new Vector4(0.5, 0.4, 0.1, 1 / 9) },
      // edges widen and the layers converge between 60 m and 900 m: band × (1 + 5), 35 % toward the shared mid-tone
      tbF: { value: new Vector4(60, 900, 5, 0.35) },
    };
  }
  function makeBlend(key, s) {
    const m = new MeshStandardMaterial();
    m.name = key;
    const sets = s.blend.map(getSet);
    if (!patchState.enabled || sets.some((x) => !x)) {
      const [c, r, mt] = s.flat;
      m.color.set(c);
      m.roughness = r;
      m.metalness = mt;
    } else {
      m.color.set('#ffffff');
      m.vertexColors = true;
      m.map = sets[0].map;
      m.normalMap = sets[0].normal;
      m.roughness = 1;
      m.metalness = 0;
      const uniforms = { ...patchUniforms(s, sets[0]), ...blendUniforms(sets) };
      m.userData.mkUniforms = uniforms;
      applyPatch(m, uniforms, patchState, { blend: true, outdoor: !!s.outdoor });
    }
    m.userData.matKey = key;
    m.userData.set = null;
    m.userData.blend = s.blend;
    if (s.outdoor && patchState.outdoor) markOutdoor(m, true);
    return m;
  }

  // ------------------------------------------------------------------ wall-foot floor map (patch.js MK_FOOT)
  // The nav grid's main layer (0.5 m cells, world metres) holds every walkable floor per cell. Over the Mount and its
  // walls (site −20…520 amot) the map keeps each cell's lowest and highest floor (world y; 9999 = none), RG32F, read
  // NEAREST. Cells the walking grid leaves empty beside walls (a body radius off them) take their neighbours' floors
  // (two rings). Built in an idle slice once the grid is ready, rebuilt whenever nav rebuilds; the band fades in.
  let footFor = null;
  let footFade = 0;
  let footHooked = false;
  let footResolve;
  const footReady = new Promise((r) => { footResolve = r; });
  function footWatch() {
    if (!footHooked && ctx.engine?.onUpdate) {
      footHooked = true;
      ctx.engine.onUpdate((dt) => {
        if (ctx.nav?.ready && ctx.nav.ready !== footFor) footWatch();
        if (footU.mkFootMap.value && footFade < 1) {
          footFade = shotMode ? 1 : Math.min(1, footFade + (dt || 0.016) / 1.5);
          footU.mkFootK.value.x = footFade;
        }
      }, 45);
    }
    const nav = ctx.nav;
    const r = nav?.ready;
    if (!r || r === footFor) return;
    footFor = r;
    r.then(() => {
      if (nav.ready !== r) return;
      const ric = globalThis.requestIdleCallback || ((f) => setTimeout(f, 50));
      ric(() => { try { buildFootMap(nav); } catch (e) { warnOnce(warned, 'foot', '[mats] wall-foot floor map failed', e); } }, { timeout: 2000 });
    });
  }
  function buildFootMap(nav) {
    const L = nav.grid?.main;
    if (!L?.nodeStart || !L.nodeY || !(L.cell > 0)) return;
    const cell = L.cell;
    const cl = (v, n) => Math.min(n, Math.max(0, v));
    const i0 = cl(Math.floor((-20 * AMAH - L.x0) / cell), L.nx), i1 = cl(Math.ceil((520 * AMAH - L.x0) / cell), L.nx);
    const j0 = cl(Math.floor((-520 * AMAH - L.z0) / cell), L.nz), j1 = cl(Math.ceil((20 * AMAH - L.z0) / cell), L.nz);
    const w = i1 - i0, h = j1 - j0;
    if (w < 2 || h < 2) return;
    let lo = new Float32Array(w * h).fill(NaN), hi = new Float32Array(w * h).fill(NaN);
    const ns = L.nodeStart, ny = L.nodeY;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = (j + j0) * L.nx + (i + i0);
        const a = ns[c], b = ns[c + 1];
        if (a === b) continue;
        let mn = Infinity, mx = -Infinity;
        for (let k = a; k < b; k++) { const y = ny[k]; if (y < mn) mn = y; if (y > mx) mx = y; }
        lo[j * w + i] = mn; hi[j * w + i] = mx;
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      const lo2 = lo.slice(), hi2 = hi.slice();
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const c = j * w + i;
          if (lo[c] === lo[c]) continue;
          let mn = Infinity, mx = -Infinity;
          for (let dj = -1; dj <= 1; dj++) {
            const jj = j + dj;
            if (jj < 0 || jj >= h) continue;
            for (let di = -1; di <= 1; di++) {
              const ii = i + di;
              if (ii < 0 || ii >= w) continue;
              const v = lo[jj * w + ii];
              if (v === v) { if (v < mn) mn = v; const u = hi[jj * w + ii]; if (u > mx) mx = u; }
            }
          }
          if (mn !== Infinity) { lo2[c] = mn; hi2[c] = mx; }
        }
      }
      lo = lo2; hi = hi2;
    }
    const data = new Float32Array(w * h * 2);
    for (let c = 0; c < w * h; c++) {
      const ok = lo[c] === lo[c];
      data[c * 2] = ok ? lo[c] : 9999;
      data[c * 2 + 1] = ok ? hi[c] : 9999;
    }
    const tex = new DataTexture(data, w, h, RGFormat, FloatType);
    tex.minFilter = tex.magFilter = NearestFilter;
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.colorSpace = NoColorSpace;
    tex.needsUpdate = true;
    const old = footU.mkFootMap.value;
    footU.mkFootMap.value = tex;
    footU.mkFoot.value.set(L.x0 + i0 * cell, L.z0 + j0 * cell, 1 / (w * cell), 1 / (h * cell));
    old?.dispose?.();
    stats.footMB = +((w * h * 8) / 1048576).toFixed(1);
    footResolve();
  }

  function get(key) {
    let m = cache.get(key);
    if (!m) {
      m = make(key);
      cache.set(key, m);
    }
    return m;
  }

  const setOf = (key) => {
    const s = SPEC[SPEC[key]?.alias || key];
    return (s?.set && SETS[s.set]) || (s?.blend && SETS[s.blend[0]]) || null;
  };

  return {
    keys: KEYS,
    get,
    has: (key) => key in SPEC,
    /** research metadata for a key: { en, sources, confidence, note } */
    info: (key) => SPEC[SPEC[key]?.alias || key]?.info || null,
    /**
     * texture set + physical tile of a key (for builders that need the course height etc.):
     * { tile: [w, h] m, rowH (mean course height), courses: course heights of one tile (m, bottom up) or null }
     */
    tile: (key) => {
      const set = setOf(key);
      if (!set) return null;
      const L = set.layout;
      const n = L ? (L.heights ? L.heights.length : Math.round(set.tile[1] / L.rowH)) : 0;
      return { tile: set.tile, rowH: L ? set.tile[1] / n : null, courses: L?.heights ? [...L.heights] : null };
    },
    /**
     * The masonry course at world height y (m; courses follow v = y): { index, y0 (m), h (m), setOut (even courses are
     * set out by the set's set-out, 4 cm on the Herodian walls), type ('shayish' | 'kochla' | 'marmara' | null) }.
     * Builders modelling set-out courses for herodian_wall_courses walk up a wall with it.
     */
    courseAt: (key, y) => {
      const set = setOf(key);
      return set?.layout ? courseAtSet(set, y) : null;
    },
    stats,
    /**
     * profiling: switch the outdoor-only materials' interior opt-out on/off — flips userData.mkInterior and env's
     * MK_NO_ROOMS define (the path that ships), or this patch's fallback when env has none; they recompile
     */
    setOutdoorOpt(on) {
      patchState.outdoor = !!on;
      for (const [key, m] of cache) {
        const s = SPEC[key];
        if (!s?.outdoor) continue;
        markOutdoor(m, !!on);
        m.needsUpdate = true;
      }
    },
    /** the GPU baker (debugging / verification: baker.bench() times each set with a GPU sync) */
    get baker() { return baker; },
    /**
     * Build the basis maps and compile the boot kinds' generator programs (in parallel); resolves when they are linked —
     * their sets then bake on get(). Sets of the later kinds are allocated (pre-cleared) on get() and bake in loaded(),
     * started at 'ready'.
     */
    async ready() {
      if (failed) return;
      const t0 = performance.now();
      try {
        const later = LATER_GROUPS.map((g) => g.filter((k) => patchState.detail || k !== 'detail'));   // (no detail layer on low)
        baker.flatFor = flatFor;
        await baker.start(BOOT_KINDS, later);
        if (shotMode) baker.compileLater();
        if (patchState.detail) for (const id of ['d_stone', 'd_metal', 'd_wood', 'd_cloth', COMB[0]]) detailTex(id);
        stats.gpuMs = baker.sync();
      } catch (e) {
        failed = true;
        console.warn('[mats] texture generation unavailable — flat materials', e);
      }
      stats.readyMs = performance.now() - t0;
      // perf-fix-2: in normal play the later groups start with the first view, not at 'ready': their ≈ 25 generator
      // programs linked alongside the first view's (main.js warm-up), and their bakes, queued in the warm-up's idle time,
      // ran on the GPU inside the first drawn frame (0.3–0.8 s later first view on the HD 4600). The intro covers the
      // view while they bake; a screenshot still bakes everything at 'ready'
      ctx.bus?.on?.(shotMode ? 'ready' : 'firstFrame', () => { this.loaded(); footWatch(); });
      ctx.bus?.on?.('quality:change', () => this.rebuild(ctx.quality));
    },
    /** resolves when the wall-foot floor map (patch.js MK_FOOT) has been built from the nav grid and uploaded */
    get footReady() { return footReady; },
    /**
     * Compile the later groups and bake their queued sets (in place: the materials already hold the textures) — group by
     * group in idle time, a few sets per slice; in screenshot mode everything at once. Resolves when all are baked.
     */
    async loaded() {
      if (failed || !baker) return;
      if (!loading) {
        loading = (async () => {
          const tw = performance.now();
          const idle = (timeout) => new Promise((res) => (globalThis.requestIdleCallback
            ? requestIdleCallback(() => res(), { timeout }) : setTimeout(res, 16)));
          try {
            await baker.whenReady;
            if (shotMode) {
              await baker.compileLater();
              baker.flush();
            } else {
              for (let i = 0; i < baker.groups.length; i++) {
                await idle(1000);
                await baker.compileGroup(i, () => idle(1000)); // (one kind's program per idle slice: perf-fix-2)
                while (baker.flush(6) > 0) await idle(250);
              }
            }
          } catch (e) {
            console.warn('[mats] texture generation failed', e);
          }
          stats.waitMs = performance.now() - tw;
          // (perf-fix-2: a screenshot waits for the GPU here; in play the read-back stalled a frame by up to 0.45 s, and
          // the scratch targets released below are freed by GL once the queued bakes are done with them)
          if (shotMode) baker.sync();
          baker.releaseScratch();
          stats.loadedMs = performance.now() - t0Lib;
          // any kind still not compiled compiles in the background, for keys used later (the preview, adopted keys)
          const ric = globalThis.requestIdleCallback || ((f) => setTimeout(f, 200));
          ric(() => baker.prepareRest().catch(() => {}));
        })();
      }
      await loading;
    },
    /** Bake every set now and wait for the GPU (verification / benchmarking; await loaded() first: sets of kinds still compiling stay queued). */
    bakeAll() {
      if (failed) return null;
      const t0 = performance.now();
      for (const k of KEYS) get(k);
      baker.flush();
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
        if (s?.blend && m.userData.mkUniforms) {
          const sets = s.blend.map((id) => baker.baked.get(id));
          if (sets.some((x) => !x)) continue;
          m.map = sets[0].map;
          m.normalMap = sets[0].normal;
          const u = m.userData.mkUniforms;
          const fresh = { ...patchUniforms(s, sets[0]), ...blendUniforms(sets) };
          for (const k of Object.keys(fresh)) u[k].value = fresh[k].value;
          if (detailWas !== patchState.detail) m.needsUpdate = true;
          continue;
        }
        const set = s?.set ? baker.baked.get(SETS[s.set]?.rotOf || s.set) : null;
        if (!set) continue;
        m.map = set.map;
        m.normalMap = set.normal;
        m.roughnessMap = m.aoMap = set.orm;
        if (set.metal) m.metalnessMap = set.orm;
        m.roughness = (s.rough ?? 1) * lowOf(s, 'rough', 1);
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
      footU.mkFootMap.value?.dispose?.();
      baker?.dispose();
    },
  };
}

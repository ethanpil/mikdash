// Material library — ctx.mats.get(name) -> THREE.Material (shared instances; never mutate per-mesh).
// PLACEHOLDER flat-color implementation; the materials task replaces internals with procedural PBR
// textures while keeping every key below stable (keys may be ADDED, never renamed).
// All textures tile in METERS (world UVs from world/geom.js: 1 UV = 1 m).
import { MeshStandardMaterial, MeshPhysicalMaterial, DoubleSide, Color } from 'three';

// key: [baseColor, roughness, metalness, extra]
// Colors follow report Part VII §21/§26 (the sources' palette).
const SPEC = {
  // stone
  marble_white:      ['#e9e4d8', 0.45, 0], // shayish — white marble
  marble_kochla:     ['#9fb3ad', 0.45, 0], // kochla — blue-green marble course
  marble_veined:     ['#d8d0c2', 0.40, 0], // marmara — veined marble course
  herodian_wall:     ['#ddd6c6', 0.60, 0], // banded courses ("waves of the sea"), drafted margins
  ashlar_plain:      ['#d9cfbb', 0.75, 0], // generic dressed stone (chambers, inner faces)
  paving_mount:      ['#cfc4ad', 0.80, 0], // Har HaBayit pavement
  paving_azarah:     ['#d6cdbd', 0.55, 0], // Azarah "precious stones" paving
  steps_stone:       ['#d3c8b2', 0.70, 0],
  lime_whitewash:    ['#f2efe6', 0.85, 0], // altar & ramp whitewash (sid)
  sikra_red:         ['#8f2a1d', 0.80, 0], // chut hasikra ochre line
  plaster:           ['#e8e2d4', 0.90, 0],
  bedrock:           ['#b9a98c', 0.95, 0], // Even Shetiyah, exposed rock
  terrain_soil:      ['#8c7a5c', 1.00, 0],
  terrain_rock:      ['#a8977a', 0.95, 0],
  ash:               ['#5a5550', 1.00, 0],
  // metals
  gold_plate:        ['#d4a640', 0.22, 1], // gold plating (gates, Kodesh walls)
  gold_green:        ['#c8b04a', 0.25, 1], // "greenish" daily gold (Yoma 44b)
  gold_red:          ['#c9803a', 0.25, 1], // zahav parvayim
  gold_vessel:       ['#e0b34c', 0.18, 1],
  bronze_corinthian: ['#c99a55', 0.28, 1], // Nikanor doors — gleamed like gold
  copper:            ['#b66d43', 0.35, 1], // kiyor
  silver:            ['#cfd2d6', 0.20, 1],
  iron:              ['#3d3b3a', 0.55, 1], // kalya orev, hooks
  // wood
  cedar:             ['#8a5a36', 0.65, 0],
  oak_milah:         ['#7a5a3a', 0.65, 0], // Ulam lintel beams
  olive_wood:        ['#9c8458', 0.55, 0], // Heichal doors (under gold)
  wood_lattice:      ['#8b6f4a', 0.75, 0], // soreg
  timber_rough:      ['#6e5137', 0.85, 0], // altar wood, scaffolds
  // textiles
  linen_white:       ['#f1ede2', 0.90, 0, { side: DoubleSide }],
  parochet:          ['#5a3a6a', 0.85, 0, { side: DoubleSide }], // techelet/argaman/tola'at shani/shesh
  curtain_linen:     ['#ece6d6', 0.90, 0, { side: DoubleSide }],
  // misc
  water:             ['#3e5b66', 0.05, 0, { physical: true, transmission: 0 }],
  glass_dark:        ['#111111', 0.30, 0],
  roof_tile:         ['#b8aa92', 0.85, 0],
  // debug
  debug:             ['#ff00ff', 0.5, 0],
};

export function createMaterialLibrary(ctx) {
  const cache = new Map();
  const make = (key) => {
    const s = SPEC[key];
    if (!s) {
      console.warn(`[mats] unknown material "${key}" — using debug`);
      return make('debug');
    }
    const [color, roughness, metalness, extra = {}] = s;
    const { physical, ...rest } = extra;
    const M = physical ? MeshPhysicalMaterial : MeshStandardMaterial;
    const m = new M({ color: new Color(color), roughness, metalness, ...rest });
    m.name = key;
    return m;
  };
  return {
    keys: Object.keys(SPEC),
    get(key) {
      if (!cache.has(key)) cache.set(key, make(key));
      return cache.get(key);
    },
    /** async hook so the real library can generate textures (in a worker / idle time) before first frame */
    async ready() {},
  };
}

// Generator "kinds": one loop-free GLSL surface function each (`void surf(vec2 p, inout S s)`, p in meters
// inside the tile), built from basis-map lookups (nT/nL noise, vT/vL Voronoi — see glsl.js). A texture SET
// (sets.js) = kind + tile size + resolution + parameter uniforms (+ masonry layout).
// Research grounding per kind is noted inline; reconstruction choices are logged in docs/decisions/materials*.md.
// Texture fetches stay outside data-dependent branches (implicit derivatives).
//
// The kinds live in themed modules (materials-2-fix split the single file as most of them were redrawn):
//   kinds-stone.js    herodian, ashlar, paving, stone, clay, marble, plaster, whitewash, rock, soil, ash, rubble
//   kinds-relief.js   relief (the Kodesh's keruvim, palms and open flowers)
//   kinds-metal.js    goldplate, metal, iron
//   kinds-wood.js     wood, logs, bark, logend, lattice, char
//   kinds-textile.js  weave, hide, rope
//   kinds-nature.js   grass, leaves, water, detail, crust, lumps
import { STONE_KINDS } from './kinds-stone.js';
import { RELIEF_KINDS } from './kinds-relief.js';
import { METAL_KINDS } from './kinds-metal.js';
import { WOOD_KINDS } from './kinds-wood.js';
import { TEXTILE_KINDS } from './kinds-textile.js';
import { NATURE_KINDS } from './kinds-nature.js';

export const KINDS = {
  ...STONE_KINDS, ...RELIEF_KINDS, ...METAL_KINDS, ...WOOD_KINDS, ...TEXTILE_KINDS, ...NATURE_KINDS,
};

export const KIND_PRELUDE = '';

// UV mappers for tagged material buckets (see lib/kit.js). All work in SITE amot and write texture meters.
//
//   relief        Kodesh / KhK walls: the gold_relief tile (palm–keruv modules 1.92 m wide, registers 2.88 m high, i.e.
//                 4 × 6 amot at 48 cm) is mapped in AMOT × 0.48, so a module is always 4 amot and a register 6 amot
//                 whatever amah standard is chosen; u runs left→right as seen facing each wall, starting at the room's
//                 corner (the palms stand on the corners), v from the top of the plinth (+23).
//   ub:r:k / ub:c:k  the Ulam's rovadin (Rambam BhB 4:9): a 3-amah course k (rovad, white / veined marble) or the plain
//                 1-amah course k between (kochla), each mapped onto ONE texture course of herodian_inner (rows 0 / 2 / 1
//                 of the white–kochla–veined cycle) so the masonry joints coincide with the modelled courses.
//   uz:z0         the white stone courses between the Ulam lintels (base z0): the white row at true scale (joints show).
//   grainY        timber running north–south (the Ulam lintels, poles): wood grain (texture U) along Y; the beams'
//                 end faces get the grain packed across the section.
import { mapUV } from './lib/kit.js';
import { AMAH } from '../../core/units.js';

const S = 0.48; // texture meters per amah for the amah-locked mappings

export function registerUV(kit, H) {
  const { kodesh, khk } = H.rooms;
  kit.uv('relief', (g) => mapUV(g, (X, Y, Z, nX, nY) => {
    const room = X < khk.max[0] + 0.5 ? khk : kodesh;
    let u;
    if (Math.abs(nY) >= Math.abs(nX)) u = nY < 0 ? X - room.min[0] : room.max[0] - X;   // N wall (faces S) / S wall
    else u = nX > 0 ? Y - room.min[1] : room.max[1] - Y;                                   // W wall (faces E) / E wall
    return [u * S, (Z - H.reliefZ0) * S];
  }));
  const courseZ = (type, k) => {
    if (type === 'c') return [H.bandBase + 4 * k, H.bandBase + 4 * k + 1];
    const z0 = H.bandBase + 4 * k + 1;
    return [z0, k >= H.bandTopK ? z0 + 4 : z0 + 3];
  };
  kit.uv('ub', (g, type, ks) => {
    const k = +ks;
    const [z0, z1] = courseZ(type, k);
    // rows of the herodian set (1.1 m each): 0 white (set out), 1 kochla (set in), 2 veined (set out), 3 white (set in).
    // The rovadin cycle shayish → kochla → marmara (Bava Batra 4a), the plain courses between are white shayish.
    const row = type === 'c' ? 3 : [0, 1, 2][k % 3];
    const rowH = 1.1, pad = 0.03;
    return mapUV(g, (X, Y, Z, nX, nY, nZ) => {
      let u;
      if (Math.abs(nZ) > 0.5) u = X * AMAH;
      else if (Math.abs(nX) >= Math.abs(nY)) u = Y * AMAH * Math.sign(nX || 1);
      else u = -X * AMAH * Math.sign(nY || 1);
      const t = Math.min(1, Math.max(0, (Z - z0) / (z1 - z0)));
      // plain courses keep their true scale (a 0.48 m slice of the 1.1 m course); rovadin are fitted to the course
      const v = type === 'c' ? row * rowH + 0.31 + (Z - z0) * AMAH : row * rowH + pad + t * (rowH - 2 * pad);
      return [u, v];
    });
  });
  // the white courses between the Ulam lintels (base z0): the white row of the herodian set at true scale, as the
  // plain rovadin courses, so their joints show
  kit.uv('uz', (g, z0s) => {
    const z0 = +z0s;
    return mapUV(g, (X, Y, Z, nX, nY, nZ) => {
      let u;
      if (Math.abs(nZ) > 0.5) u = X * AMAH;
      else if (Math.abs(nX) >= Math.abs(nY)) u = Y * AMAH * Math.sign(nX || 1);
      else u = -X * AMAH * Math.sign(nY || 1);
      return [u, 3 * 1.1 + 0.31 + (Z - z0) * AMAH];
    });
  });
  kit.uv('grainY', (g) => mapUV(g, (X, Y, Z, nX, nY, nZ) => {
    // the beam's ends (facing ±Y) show the end grain: the texture's grain lines packed tight across the section
    if (Math.abs(nY) > 0.5) return [Z * AMAH * 6, X * AMAH];
    const u = -Y * AMAH;
    const v = Math.abs(nZ) > 0.5 ? X * AMAH : Z * AMAH;
    return [u, v];
  }));
}

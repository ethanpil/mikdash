// UV mappers for tagged material buckets (see lib/kit.js). All work in SITE amot and write texture meters.
//
//   relief        Kodesh / KhK walls: the gold_relief tile (palm–keruv modules 1.92 m wide, registers 2.88 m high, i.e.
//                 4 × 6 amot at 48 cm) is mapped in AMOT × 0.48, so a module is always 4 amot and a register 6 amot
//                 whatever amah standard is chosen; u runs left→right as seen facing each wall, starting at the room's
//                 corner (the palms stand on the corners), v from the top of the plinth (+23).
//   ub:r:k / ub:c:k  the Ulam's rovadin (Rambam BhB 4:9): a 3-amah course k (rovad) or the plain 1-amah course k
//                 between, each mapped onto ONE course of herodian_wall_inner_courses' course table (world-4: the rows
//                 are read from ctx.mats — materials/courses.js courseRows — not assumed 1.1 m): a rovad onto a SET-OUT
//                 row of its marble, in the cycle shayish → kochla → marmara (Bava Batra 4a), fitted to the row; a plain
//                 course onto a DRAWN-IN white row at true scale — so the joints, the baked set-out relief and the
//                 shelter band under a set-out course coincide with the modelled courses.
//   uz:z0         the white stone courses between the Ulam lintels (base z0): the same drawn-in white row, true scale.
//   grainY        timber running north–south (the Ulam lintels, poles): wood grain (texture U) along Y; the beams'
//                 end faces get the grain packed across the section.
import { mapUV } from './lib/kit.js';
import { AMAH } from '../../core/units.js';
import { courseRows } from '../materials/courses.js';

const WALL_IN = 'herodian_wall_inner_courses';

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
  // the texture rows: a set-out row of each marble for the rovadin (shayish, kochla, marmara in turn — Bava Batra 4a),
  // a drawn-in white row for the plain courses between them and the stones between the lintels
  const rows = courseRows(kit.ctx.mats, WALL_IN);
  const pick = (type, setOut) => rows.find((r) => r.type === type && r.setOut === setOut) || rows.find((r) => r.type === type) || rows[0];
  const ROVAD = ['shayish', 'kochla', 'marmara'].map((t) => pick(t, true));
  const PLAIN = pick('shayish', false);
  // a plain course (1 amah) at true scale, centred in its row
  const plainV = (dz) => PLAIN.y0 + Math.max(0.02, (PLAIN.h - AMAH) / 2) + dz * AMAH;
  kit.uv('ub', (g, type, ks) => {
    const k = +ks;
    const [z0, z1] = courseZ(type, k);
    const row = ROVAD[k % 3], pad = 0.03;
    return mapUV(g, (X, Y, Z, nX, nY, nZ) => {
      let u;
      if (Math.abs(nZ) > 0.5) u = X * AMAH;
      else if (Math.abs(nX) >= Math.abs(nY)) u = Y * AMAH * Math.sign(nX || 1);
      else u = -X * AMAH * Math.sign(nY || 1);
      const t = Math.min(1, Math.max(0, (Z - z0) / (z1 - z0)));
      // plain courses keep their true scale; rovadin are fitted to their row (its joints at the course's edges)
      const v = type === 'c' ? plainV(Z - z0) : row.y0 + pad + t * (row.h - 2 * pad);
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
      return [u, plainV(Z - z0)];
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

// The chambers on the Mount (mount.chamber.*; footprints unsourced, site.js): Lishkat HaParochet and Lishkat HaKorban
// (Levite watch posts — Middot 1:1) flanking the foot of the Korban gate flight, and Lishkat Beit HaEven (Parah 3:1),
// the stone house facing the Birah. Plain dressed-stone rooms with a lime roof, a cedar ceiling and one door each;
// no windows (none attested for the chambers — Part VII §22). Each door has two cedar leaves standing open against
// the inside of the wall ⚙ — Beit HaEven too: the stone / dung / earth rule of Yoma 2a is about its vessels, and a
// door fixed to the building is not a vessel.
const WT = 1.5, ROOF = 1, EAVE = 0.3;

export function buildChambers(ctx, kit, detail) {
  for (const id of ['mount.chamber.parochet', 'mount.chamber.korban', 'mount.chamber.beit-haeven']) {
    const e = ctx.el(id);
    const [x0, y0, z0] = e.box.min, [x1, y1, z1] = e.box.max;
    const d = e.params.door;
    const zc = z1 - ROOF;
    const ext = 'ashlar_plain', inn = 'plaster';
    const dz1 = d.z[1];
    // east and west walls (full)
    kit.faces([x0, y0 + WT, z0], [x0 + WT, y1 - WT, zc], { w: ext, e: inn });
    kit.faces([x1 - WT, y0 + WT, z0], [x1, y1 - WT, zc], { e: ext, w: inn });
    // north and south walls; the door face split round the opening
    for (const face of ['south', 'north']) {
      const ya = face === 'south' ? y0 : y1 - WT, yb = ya + WT;
      const o = face === 'south' ? 's' : 'n', i = face === 'south' ? 'n' : 's';
      if (d.face !== face) { kit.faces([x0, ya, z0], [x1, yb, zc], { [o]: ext, [i]: inn, e: ext, w: ext }); continue; }
      kit.faces([x0, ya, z0], [d.x[0], yb, zc], { [o]: ext, [i]: inn, w: ext, e: ext });
      kit.faces([d.x[1], ya, z0], [x1, yb, zc], { [o]: ext, [i]: inn, e: ext, w: ext });
      kit.faces([d.x[0], ya, dz1], [d.x[1], yb, zc], { [o]: ext, [i]: inn, b: ext });
      kit.quad([[d.x[0], ya, z0 + 0.02], [d.x[1], ya, z0 + 0.02], [d.x[1], yb, z0 + 0.02], [d.x[0], yb, z0 + 0.02]], [0, 0, 1], 'steps_stone');
      if (detail >= 1) {
        // two cedar leaves standing open against the inside of the wall
        const inward = face === 'south' ? 1 : -1;
        const yIn = face === 'south' ? yb : ya;
        const lw = (d.x[1] - d.x[0]) / 2;
        for (const [hx, dir] of [[d.x[0], 1], [d.x[1], -1]]) {
          const xa = dir > 0 ? hx - 0.25 : hx, xb = dir > 0 ? hx : hx + 0.25;
          const ys = [yIn, yIn + inward * lw].sort((p, q) => p - q);
          kit.box([xa, ys[0], z0 + 0.05], [xb, ys[1], dz1 - 0.05], 'cedar_v', { collide: false });
        }
      }
    }
    // roof slab (lime) with a plain eave, cedar boards under it
    kit.faces([x0 - EAVE, y0 - EAVE, zc], [x1 + EAVE, y1 + EAVE, z1], { t: 'roof_tile', e: ext, w: ext, n: ext, s: ext, b: ext });
    kit.quad([[x0 + WT, y0 + WT, zc - 0.01], [x1 - WT, y0 + WT, zc - 0.01], [x1 - WT, y1 - WT, zc - 0.01], [x0 + WT, y1 - WT, zc - 0.01]], [0, 0, -1], 'cedar', { collide: false });
  }
}

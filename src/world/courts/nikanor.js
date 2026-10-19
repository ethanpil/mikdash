// Sha'ar Nikanor (Middot 1:4, 2:3, 2:6; Yoma 38a; lock #14), its two wickets and the flanking chambers of
// Pinchas HaMalbish and the chavitin bakers (Middot 1:4; Rambam BhB 5:17); Ezrat Yisrael, the 1-amah step and the
// duchan (Middot 2:6; Rambam BhB 6:3; lock #10).
import { B, Mesher, wedge, lathe } from './lib/geo.js';
import { shell } from './lib/parts.js';

export function buildNikanor(C) {
  const g = C.el('azarah.gate.nikanor').box;
  const ax = C.axisY;
  // Corinthian bronze leaves, unplated, "gleaming like gold" (Yoma 38a; Middot 2:3); hinged at the EN face, folding west.
  // Fully open they stand at 72° to the wall line, not flat on the passage walls, so their faces show from Ezrat Nashim ⚙
  C.doorPair('azarah.gate.nikanor', 'bronzeLeaf', g.min[1], g.max[1], 'y', g.max[0] - 0.25, g.min[2], [-1, 0], { open: 1, label: "Sha'ar Nikanor", maxAngle: Math.PI * 0.4 });
  C.curtain('azarah.gate.nikanor', [g.min[0] - 0.45, g.min[1] - 1, g.min[2]], [0, 1], "Sha'ar Nikanor");
  // the two chambers in the wall and their wickets (EK / Chanukat HaBayit: the wickets are their doorways)
  for (const [ch, wk, label] of [['azarah.chamber.pinchas', 'azarah.gate.nikanor.wicket-n', 'Pinchas'], ['azarah.chamber.chavitin', 'azarah.gate.nikanor.wicket-s', 'chavitin']]) {
    const b = C.el(ch).box, w = C.el(wk).box;
    const cy = (b.min[1] + b.max[1]) / 2;
    const t = 1;
    const west = B(b.min[0] - 0.01, cy - 2, b.min[2] - 0.01, b.min[0] + t + 0.01, cy + 2, b.min[2] + 8, { mat: 'ashlar_plain' });
    shell(C, B(...b.min, ...b.max), { t, room: 'ashlar_plain', floor: 'paving_azarah', top: 'roof_plaster',
      doors: [B(w.max[0] - t - 0.01, w.min[1], w.min[2] - 0.01, w.max[0] + 0.01, w.max[1], w.max[2], { mat: 'marble_white' }), west] });
    // the wicket's leaf (bronze, as its gate ⚙) hinged at the EN face, folding into the chamber
    const north = w.min[1] > ax;
    C.doorSingle(wk, 'bronzeWicket', [w.max[0] - 0.2, north ? w.max[1] : w.min[1], w.min[2]], [0, north ? -1 : 1], [-1, 0], w.max[1] - w.min[1], w.max[2] - w.min[2], { open: 0 });
    C.doorCase({ axis: 'x', at: w.max[0], out: 1, lo: w.min[1], hi: w.max[1], z0: w.min[2], z1: w.max[2] }, 0.6, 0.16);
    // the door to Ezrat Yisrael (cedar)
    C.doorSingle(`${ch}.door`, 'cedarSmall4x8', [b.min[0] + 0.2, cy - 2, b.min[2]], [0, 1], [1, 0], 4, 8, { open: 0.75 });
    C.doorCase({ axis: 'x', at: b.min[0], out: -1, lo: cy - 2, hi: cy + 2, z0: b.min[2], z1: b.min[2] + 8 }, 0.6, 0.16);
    const inner = { min: [b.min[0] + t, b.min[1] + t, b.min[2]], max: [b.max[0] - t, b.max[1] - t, b.max[2] - t] };
    if (label === 'Pinchas') vestments(C, inner, north);
    else chavitinBakery(C, inner, north);
    C.anchor(`courts.chamber.${ch.split('.').pop()}`, [b.min[0] + 3, cy, b.min[2]], 90, C.el(ch).name.en);
  }
  // ---- Ezrat Yisrael and the duchan: the 1-amah riser needs a walkable ramp collider (the player steps ≤ 0.35 m)
  const du = C.el('azarah.duchan'), prof = du.params.profile;
  const r = new Mesher();
  wedge(r, 'x', prof[0].x + 1.0, prof[0].x, du.box.min[1], du.box.max[1], prof[0].topZ - prof[0].rise, prof[0].topZ);
  C.ctx.addCollider(r.geometry(), 'courts:duchan-ramp');
  const eyZ = C.datums.ezratYisrael;
  C.anchor('courts.nikanor.threshold', [(g.min[0] + g.max[0]) / 2, ax, g.min[2]], 270, "Nikanor threshold — station of the metzora, sotah and yoledet");
  C.anchor('courts.gate.nikanor', [g.max[0] + 3, ax, g.min[2]], 270, "Sha'ar Nikanor");
  C.anchor('courts.ezrat-yisrael', [(du.box.max[0] + g.min[0]) / 2 + 1, ax + 14, eyZ], 270, "Ezrat Yisrael — the ma'amad");
  C.anchor('courts.duchan', [prof[1].x - 0.25, ax, prof[1].topZ], 270, 'The duchan of the Levites (its centre, on the axis)');
}

/** Pinchas HaMalbish: presses for the white garments (Middot 1:4; Tamid 5:3) ⚙ */
function vestments(C, r, north) {
  const z = r.min[2];
  const wood = C.kit.m('cedar', true, true), linen = C.kit.m('linen_white', false, false);
  const yb = north ? r.max[1] - 1.6 : r.min[1];
  // two tall presses along the far wall, a folding table in the middle
  for (let i = 0; i < 2; i++) {
    const x0 = r.min[0] + 0.5 + i * 4.5;
    wood.box([x0, yb, z], [x0 + 4, yb + 1.6, z + 7]);
    if (C.d >= 1) for (let s = 0; s < 4; s++) linen.box([x0 + 0.3, north ? yb - 0.02 : yb + 1.6, z + 1 + s * 1.5], [x0 + 3.7, north ? yb : yb + 1.62, z + 1.9 + s * 1.5], north ? 'y' : 'Y');
  }
  wood.box([r.min[0] + 3, (r.min[1] + r.max[1]) / 2 - 1, z], [r.max[0] - 3, (r.min[1] + r.max[1]) / 2 + 1, z + 1.7]);
  if (C.d >= 1) for (let i = 0; i < 4; i++) linen.box([r.min[0] + 3.5 + i * 1.1, (r.min[1] + r.max[1]) / 2 - 0.6, z + 1.7], [r.min[0] + 4.3 + i * 1.1, (r.min[1] + r.max[1]) / 2 + 0.6, z + 1.95]);
}

/** the chavitin bakers (Middot 1:4): a hearth with the flat griddle (machavat) and a kneading table ⚙ */
function chavitinBakery(C, r, north) {
  const z = r.min[2];
  const stone = C.kit.m('ashlar_plain', true, true);
  const yb = north ? r.max[1] - 2 : r.min[1];
  stone.box([r.min[0] + 1, yb, z], [r.min[0] + 4.5, yb + 2, z + 1.6]);
  C.kit.geo(lathe([[0, 0], [1.1, 0], [1.15, 0.12], [1.05, 0.12], [0, 0.05]], [r.min[0] + 2.75, yb + 1, z + 1.6], 16), 'iron', { collide: false });
  C.kit.m('cedar', true, true).box([r.max[0] - 4.5, (r.min[1] + r.max[1]) / 2 - 1, z], [r.max[0] - 1, (r.min[1] + r.max[1]) / 2 + 1, z + 1.7]);
}

// Doors of the Heichal, as instanced leaves animated through ctx.movables (lib/kit.js addDoor):
//   the great gate (Middot 4:1): FOUR gold-plated olive-wood leaves — the outer pair hinged at the Ulam face, opening
//   90° into the doorway to cover the 6-amah thickness; the inner pair hinged at the Kodesh face, opening 180° into the
//   house to lie flat on the 10 amot of wall behind the doors (left unplated); the north wicket (daily entry, Tamid 3:7)
//   and the south wicket (never opened — Middot 4:2); the two 8-amah wickets of the beit hachalifot (Zevachim 55b);
//   the NE ta's doors to the Heichal and to the mesibah; the aliyah door (cedar).
import { leafSet, addDoor, leafGeometry } from './lib/kit.js';

export function buildDoors(H) {
  const { kit, el, d } = H;
  const T = 0.4, Tw = 0.3, gap = 0.02;
  const gate = el('heichal.gate.great').box;
  const xU = gate.max[0], xK = gate.min[0];                // Ulam face 163, Kodesh face 157
  const yS = gate.min[1], yN = gate.max[1], zF = gate.min[2];
  const hG = gate.max[2] - gate.min[2] - 0.02;
  // one unit leaf (5 × 20) scaled per instance: all four great-gate leaves in one draw call
  const unitW = (yN - yS) / 2;
  const gold = leafSet(kit, 'gold-gate', 'gold_vessel', () => leafGeometry(unitW, hG, T, 'gold', d));
  const wOuter = unitW - T / 2 - gap, wInner = unitW - gap;
  const leaves = [
    // outer pair: hinge T/2 inside the passage from the Ulam face and from the jamb
    { set: gold, group: 'outer', hinge: [xU - T / 2, yS + T / 2, zF], along: [0, 1], into: [-1, 0], scale: [wOuter / unitW, 1, 1] },
    { set: gold, group: 'outer', hinge: [xU - T / 2, yN - T / 2, zF], along: [0, -1], into: [-1, 0], scale: [wOuter / unitW, 1, 1] },
    // inner pair: hinge on the Kodesh face line, closing just inside the house, folding back 180° onto the wall
    { set: gold, group: 'inner', hinge: [xK - T / 2, yS, zF], along: [0, 1], into: [-1, 0], angle: Math.PI, scale: [wInner / unitW, 1, 1] },
    { set: gold, group: 'inner', hinge: [xK - T / 2, yN, zF], along: [0, -1], into: [-1, 0], angle: Math.PI, scale: [wInner / unitW, 1, 1] },
  ];
  addDoor(kit, 'heichal.gate.great', leaves, {
    open: 1, center: [(xU + xK) / 2, (yS + yN) / 2, zF], label: 'The great gate of the Heichal',
    extra: { groups: ['outer', 'inner'], note: 'outer pair 90° into the doorway, inner pair 180° onto the wall behind the doors' },
  });

  // wickets (8 high): gold leaves, hinged at the Ulam face, swinging into the passage
  const wk = (id, open, extra) => {
    const b = el(id).box;
    const h = b.max[2] - b.min[2] - 0.02, w = b.max[1] - b.min[1] - Tw / 2 - gap;
    const set = leafSet(kit, 'gold-wicket', 'gold_vessel', () => leafGeometry(3 - Tw / 2 - gap, 8 - 0.02, Tw, 'gold', d));
    addDoor(kit, id, [{ set, hinge: [b.max[0] - Tw / 2, b.min[1] + Tw / 2, b.min[2]], along: [0, 1], into: [-1, 0], scale: [w / (3 - Tw / 2 - gap), h / (8 - 0.02), 1] }],
      { open, center: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]], label: el(id).name.en, extra });
  };
  wk('heichal.gate.wicket-n', 0, { daily: true });
  wk('heichal.gate.wicket-s', 0, { permanentlyClosed: true, note: 'never opened (Middot 4:2; Yechezkel 44:2)' });
  wk('heichal.chalifot.n.wicket', 0, { sanctityOpening: true });
  wk('heichal.chalifot.s.wicket', 0, { sanctityOpening: true });

  // the NE ta's door into the Heichal (gold, the house's side) and its door to the mesibah (cedar), both into the ta
  const ta = el('heichal.ta.door-ne').box;
  const setTa = leafSet(kit, 'gold-wicket', 'gold_vessel', null);
  const wTa = ta.max[0] - ta.min[0] - Tw / 2 - gap;
  addDoor(kit, 'heichal.ta.door-ne', [{ set: setTa, hinge: [ta.min[0] + Tw / 2, ta.max[1] - Tw / 2, ta.min[2]], along: [1, 0], into: [0, 1], scale: [wTa / (3 - Tw / 2 - gap), 1, 1] }],
    { open: 0, center: [(ta.min[0] + ta.max[0]) / 2, ta.max[1], ta.min[2]], label: 'Door from the NE ta into the Heichal' });
  const md = el('heichal.ta-wall.north').params.door;
  const cedarS = leafSet(kit, 'cedar-small', 'cedar_v', () => leafGeometry(3 - Tw / 2 - gap, 8 - 0.02, Tw, 'plank', d));
  addDoor(kit, 'heichal.ta-wall.north', [{ set: cedarS, hinge: [md.min[0] + Tw / 2, md.min[1] + Tw / 2, md.min[2]], along: [1, 0], into: [0, -1] }],
    { open: 0, center: [(md.min[0] + md.max[0]) / 2, md.min[1], md.min[2]], label: 'Door from the NE ta to the mesibah' });

  // the aliyah door: two cedar leaves opening into the aliyah (north)
  const ad = el('heichal.aliyah.door').box;
  const wA = (ad.max[0] - ad.min[0]) / 2 - Tw / 2 - gap, hA = ad.max[2] - ad.min[2] - 0.02;
  const cedarL = leafSet(kit, 'cedar-large', 'cedar_v', () => leafGeometry(wA, hA, Tw, 'plank', d));
  addDoor(kit, 'heichal.aliyah.door', [
    { set: cedarL, hinge: [ad.min[0] + Tw / 2, ad.max[1] - Tw / 2, ad.min[2]], along: [1, 0], into: [0, 1] },
    { set: cedarL, hinge: [ad.max[0] - Tw / 2, ad.max[1] - Tw / 2, ad.min[2]], along: [-1, 0], into: [0, 1] },
  ], { open: 0, center: [(ad.min[0] + ad.max[0]) / 2, ad.max[1], ad.min[2]], label: 'Door of the aliyah' });
}

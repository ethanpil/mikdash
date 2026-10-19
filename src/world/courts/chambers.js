// The six chambers of the Azarah (Middot 5:3–4; Yoma 19a, 25a; Rambam BhB 5:17; lock #7 — salt trio south,
// Gazit trio north): Lishkat HaGazit (a hewn-stone basilica half kodesh / half chol), Lishkat HaGolah (cistern and
// wheel), Lishkat HaEtz = Parhedrin (the Kohen Gadol's chamber, opening only to the chel), and Melach, Parvah (the KG's
// roof mikveh) and Medichin (its winding stair).
import { B, gridSolid, lathe } from './lib/geo.js';
import { shell, flight, spiral, lampStand } from './lib/parts.js';
import { classify } from './masonry.js';
import { meshOf, Object3D, boxAt, finishLocal } from './lib/kit.js';
import { AMAH, m2w } from '../../core/units.js';
import { CylinderGeometry, TorusGeometry } from 'three';

export function buildChambers(C) {
  gazit(C);
  golah(C);
  etz(C);
  southTrio(C);
}

// ------------------------------------------------------------------------------------------------ Gazit
function gazit(C) {
  const e = C.el('azarah.chamber.gazit'), b = e.box, p = e.params;
  const Z = b.min[2], t = 1, top = b.max[2], ceil = top - 1;
  const split = p.dividingLine.x, cy = (b.min[1] + b.max[1]) / 2;
  const [dE, dW] = p.doors;
  // chamber doors 16 high under the 20-amah roof ⚙ (Middot 2:3's 20 × 10 needs a higher roof — asked of site-model);
  // a height given in site.js (doors[].z) wins
  const hDoor = dE.z ? dE.z[1] - dE.z[0] : 16;
  const doors = [
    B(dE.x - t - 0.01, dE.y[0] + 1, Z - 0.01, dE.x + 0.01, dE.y[1], Z + hDoor, { mat: 'marble_white' }),
    B(dW.x - 0.01, dW.y[0], Z - 0.01, dW.x + t + 0.01, dW.y[1], Z + hDoor, { mat: 'marble_white' }),
  ];
  // clerestory-height windows in the free south wall and the chol north wall ⚙ (chambers' windows unattested)
  const win = (x) => B(x - 1, b.min[1] - 0.01, Z + 12, x + 1, b.min[1] + t + 0.01, Z + 17, { mat: 'ashlar_plain' });
  doors.push(win(b.min[0] + 6), win(b.min[0] + 16), win(split + 7), win(split + 16));
  doors.push(B(b.min[0] + 6, b.max[1] - t - 0.01, Z + 12, b.min[0] + 8, b.max[1] + 0.01, Z + 17, { mat: 'ashlar_plain' }),
    B(b.min[0] + 14, b.max[1] - t - 0.01, Z + 12, b.min[0] + 16, b.max[1] + 0.01, Z + 17, { mat: 'ashlar_plain' }));
  // Tamid 5:3: niches where the kohanim laid their garments, "the uses of the vessels" written on them —
  // four per mishmar = 96, in two rows along the kodesh half's long walls (detail ≥ 1) ⚙
  if (C.d >= 1) {
    const n = 24, x0 = split + 0.4, dx = (b.max[0] - t - 0.4 - x0) / n;
    for (const [y, inward] of [[b.min[1] + t, -1], [b.max[1] - t, 1]]) for (const z0 of [Z + 1.6, Z + 3.0]) for (let i = 0; i < n; i++) {
      const x = x0 + dx * (i + 0.5);
      doors.push(B(x - dx * 0.36, inward < 0 ? y - 0.55 : y - 0.01, z0, x + dx * 0.36, inward < 0 ? y + 0.01 : y + 0.55, z0 + 1.05, { mat: 'ashlar_plain' }));
    }
  }
  shell(C, B(...b.min, ...b.max), { t, room: 'herodian_wall_inner', ceil: 'ashlar_plain', floor: 'paving_azarah', top: 'roof_plaster', doors });
  // ---- the kodesh half: a basilica nave between two rows of marble columns carrying stone architraves (no wood in
  // the Azarah — Rambam BhB 1:9); the chol half: an open hall under cedar beams for the Sanhedrin ⚙
  const rows = [b.min[1] + t + 3.6, b.max[1] - t - 3.6];
  const colX = [split + 4, split + 10.5, split + 17];
  const colH = ceil - 1.6 - Z;
  for (const y of rows) for (const x of colX) C.column([x, y, Z], colH, 0.95);
  const arch = C.kit.m('marble_white', false, true);
  for (const y of rows) arch.box([split + 1.5, y - 0.7, ceil - 1.6], [b.max[0] - t, y + 0.7, ceil]);
  // cedar beams across the chol half (ends on the walls) and a marble beam on the kodesh line
  const cedar = C.kit.m('cedar', false, true);
  for (let x = b.min[0] + t + 1.5; x < split - 1; x += 2.6) cedar.box([x - 0.35, b.min[1] + t, ceil - 1.1], [x + 0.35, b.max[1] - t, ceil]);
  arch.box([split - 0.6, b.min[1] + t, ceil - 1.6], [split + 0.6, b.max[1] - t, ceil]);
  // rashei pispasin: projecting heads in the floor marking the line between kodesh and chol (Middot 1:6; lock #43)
  const ph = C.kit.m('marble_veined', false, true);
  for (let y = b.min[1] + t + 0.5; y < b.max[1] - t; y += 1) ph.box([split - 0.15, y - 0.15, Z], [split + 0.15, y + 0.15, Z + 0.07]);
  // ---- the Sanhedrin's semicircle "like half a round threshing floor, so they see one another" (Sanhedrin 4:3):
  // four stepped tiers of stone benches, open toward the chol door; ≥ 71 places at an amah each (EK's measure) ⚙
  const [sx] = p.stations.sanhedrin;
  const cxy = [sx, cy];
  const rIn = [4.6, 5.7, 6.8, 7.9], rOut = Math.min(8.95, cy - b.min[1] - t - 0.05), tz = [0.9, 1.5, 2.1, 2.7];
  amphitheatre(C, cxy, Z, rIn, rOut, tz);
  // the nasi's seat at the apex, a little raised; two scribes' desks before them (Sanhedrin 4:3)
  const seat = C.kit.m('marble_white', true, true);
  seat.box([sx + rIn[0] - 0.05, cy - 0.75, Z + tz[0]], [sx + rIn[0] + 0.7, cy + 0.75, Z + tz[0] + 0.35]);
  // the two scribes stand before them (Sanhedrin 4:3 "omdin lifneihem"): standing lecterns, sloped up toward the judges ⚙
  const wood = C.kit.m('cedar', true, true);
  for (const s of [-1, 1]) {
    const x = sx - 0.9, y = cy + s * 3;
    wood.box([x - 0.45, y - 0.35, Z], [x + 0.45, y + 0.35, Z + 0.15]);
    wood.box([x - 0.13, y - 0.13, Z + 0.15], [x + 0.13, y + 0.13, Z + 1.95]);
    wood.beam([x - 0.42, y, Z + 1.98], [x + 0.3, y, Z + 2.32], 1.0, 0.07);
    wood.box([x - 0.5, y - 0.5, Z + 1.9], [x - 0.42, y + 0.5, Z + 2.06]);
  }
  // lamps on stands at the column rows (the dawn lotteries were held before daylight — Tamid 1:2, 3:1)
  const lid = ['sw', 'se', 'nw', 'ne'];
  [[split + 1.8, rows[0] + 1.5], [b.max[0] - 3, rows[0] + 1.5], [split + 1.8, rows[1] - 1.5], [b.max[0] - 3, rows[1] - 1.5]]
    .forEach(([x, y], i) => lampStand(C, `courts.gazit.lamp-${lid[i]}`, x, y, Z, { schedule: 'night' }));
  // doors: cedar leaves (chamber doors ⚙)
  C.doorPair('azarah.chamber.gazit.east', 'cedarLeaf16', dE.y[0] + 1, dE.y[1], 'y', dE.x - 0.25, Z, [-1, 0], { open: 1, h: hDoor });
  C.doorPair('azarah.chamber.gazit.west', 'cedarLeaf16', dW.y[0], dW.y[1], 'y', dW.x + 0.25, Z, [1, 0], { open: 1, h: hDoor });
  // marble door-cases on the court (kodesh) and chel faces
  C.doorCase({ axis: 'x', at: b.max[0], out: 1, lo: dE.y[0] + 1, hi: dE.y[1], z0: Z, z1: Z + hDoor }, 0.8, 0.18);
  C.doorCase({ axis: 'x', at: b.min[0], out: -1, lo: dW.y[0], hi: dW.y[1], z0: Z, z1: Z + hDoor }, 0.8, 0.18);
  // the flight to the chel from the chol door (32 half-steps — EK I 202–215)
  const fl = C.el('azarah.chamber.gazit.flight');
  flight(C, { axis: 'x', head: b.min[0], dir: -1, c0: fl.box.min[1], c1: fl.box.max[1], steps: fl.params.steps, zTop: Z });
  const [lx, ly] = p.stations.lottery;
  C.anchor('courts.gazit.lottery', [lx, ly, Z], 270, 'Lishkat HaGazit — the lottery (kodesh half)');
  C.anchor('courts.gazit.sanhedrin', [sx + rIn[0] + 0.35, cy, Z + tz[0] + 0.35], 270, 'Lishkat HaGazit — seat of the Sanhedrin (chol half)');
  C.anchor('courts.chamber.gazit', [b.max[0] - 3, cy - 4, Z], 270, e.name.en);
  C.anchor('courts.gate.gazit.west', [b.min[0] - 2, cy, Z], 90, 'Lishkat HaGazit — the chol door');
}

/** stepped semicircular tiers about c (open toward −X), tops tz above floor Z */
function amphitheatre(C, c, Z, rIn, rOut, tz) {
  const m = C.kit.m('marble_white', true, true);
  const n = [16, 24, 32, 48][C.d] || 24;
  // profile in (r, z), outer polygon from the front-bottom up the steps to the back and down
  const prof = [[rIn[0], Z]];
  for (let k = 0; k < rIn.length; k++) {
    prof.push([rIn[k], Z + tz[k]]);
    prof.push([k + 1 < rIn.length ? rIn[k + 1] : rOut, Z + tz[k]]);
  }
  prof.push([rOut, Z]);
  const P = (r, z, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), z];
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (Math.PI * i) / n, a1 = -Math.PI / 2 + (Math.PI * (i + 1)) / n, am = (a0 + a1) / 2;
    for (let k = 0; k + 1 < prof.length; k++) {
      const [r0, z0] = prof[k], [r1, z1] = prof[k + 1];
      // segment normal in (r, z): rotate (dr, dz) by +90° (profile runs from the front up and back)
      const dr = r1 - r0, dz = z1 - z0;
      const nr = -dz, nz = dr;
      const hint = [Math.cos(am) * nr, Math.sin(am) * nr, nz];
      m.quadH(P(r0, z0, a0), P(r1, z1, a0), P(r1, z1, a1), P(r0, z0, a1), hint);
    }
  }
  // end caps on the diameter
  for (const [a, s] of [[-Math.PI / 2, -1], [Math.PI / 2, 1]]) m.poly(prof.map(([r, z]) => P(r, z, a)), [0, s, 0]);
}

// ------------------------------------------------------------------------------------------------ Golah
// "the Golah chamber — there the cistern stood with the wheel placed on it, and from there they supplied water to the
// whole Azarah" (Middot 5:4).
function golah(C) {
  const e = C.el('azarah.chamber.golah'), b = e.box, p = e.params;
  const Z = b.min[2], t = 1;
  const dr = p.door;
  shell(C, B(...b.min, ...b.max), { t, room: 'ashlar_plain', floor: 'paving_azarah', top: 'roof_plaster',
    doors: [B(dr.x[0], b.min[1] - 0.01, Z - 0.01, dr.x[1], b.min[1] + t + 0.01, Z + 8, { mat: 'marble_white' })] });
  C.doorSingle('azarah.chamber.golah', 'cedarSmall4x8', [dr.x[0], b.min[1] + 0.2, Z], [1, 0], [0, 1], dr.x[1] - dr.x[0], 8, { open: 0.8 });
  C.doorCase({ axis: 'y', at: b.min[1], out: -1, lo: dr.x[0], hi: dr.x[1], z0: Z, z1: Z + 8 }, 0.6, 0.16);
  // the cistern: plastered pit under the floor, mouth 3 × 3 with a stone curb
  const cb = p.cistern.box, cx = (cb.min[0] + cb.max[0]) / 2, cyy = (cb.min[1] + cb.max[1]) / 2;
  const mouth = 1.5;
  // carved out of the court's fill: the cistern chamber and its mouth through the pavement
  C.floorHoles.push(B(cx - mouth, cyy - mouth, cb.max[2] - 0.01, cx + mouth, cyy + mouth, Z + 0.01, { room: 'ashlar_plain' }));
  C.floorHoles.push(B(cb.min[0], cb.min[1], cb.min[2], cb.max[0], cb.max[1], cb.max[2], { room: 'plaster', floor: 'plaster', ceil: 'ashlar_plain' }));
  const waterZ = cb.min[2] + 6;
  C.kit.m('water', false, false).box([cb.min[0], cb.min[1], waterZ], [cb.max[0], cb.max[1], waterZ], 'Z');
  // the curb (a raised stone collar round the mouth)
  C.kit.solid(gridSolid([B(cx - mouth - 0.6, cyy - mouth - 0.6, Z, cx + mouth + 0.6, cyy + mouth + 0.6, Z + 1.3, { top: 'marble_white', side: 'marble_white' })],
    [B(cx - mouth, cyy - mouth, Z - 0.1, cx + mouth, cyy + mouth, Z + 1.4, { room: 'marble_white' })], classify), true, true);
  // ---- the wheel (galgal): posts carry an axle along X over the mouth: a rope drum and a large hand-wheel ⚙ form
  const az = Z + 5.2;                        // axle height
  const postX = [cx - mouth - 1.2, cx + mouth + 1.2];
  const posts = C.kit.m('cedar_v', true, true);
  for (const x of postX) posts.box([x - 0.3, cyy - 0.3, Z + 1.3], [x + 0.3, cyy + 0.3, az + 0.5]);
  for (const x of postX) C.kit.m('cedar', false, true).beam([x, cyy - 1.4, Z + 1.3], [x, cyy, az - 0.2], 0.25, 0.25);
  const A = AMAH;
  const parts = [];
  const axle = new CylinderGeometry(0.16 * A, 0.16 * A, (postX[1] - postX[0] + 0.8) * A, 10); axle.rotateZ(Math.PI / 2); parts.push(axle);
  const drum = new CylinderGeometry(0.55 * A, 0.55 * A, 2.2 * A, C.d >= 2 ? 18 : 12); drum.rotateZ(Math.PI / 2); parts.push(drum);
  const R = 2.1, wx = postX[1] - cx - 0.6;
  const rim = new TorusGeometry(R * A, 0.13 * A, 6, C.d >= 2 ? 36 : 20); rim.rotateY(Math.PI / 2); rim.translate(wx * A, 0, 0); parts.push(rim);
  for (let i = 0; i < 8; i++) {
    const sp = boxAt(-0.08 * A, -R * A, -0.08 * A, 0.08 * A, R * A, 0.08 * A);
    sp.rotateX((i * Math.PI) / 8); sp.translate(wx * A, 0, 0); parts.push(sp);
  }
  for (let i = 0; i < 8; i++) {   // hand-spokes beyond the rim
    const a = (i * Math.PI) / 4, h = boxAt(-0.06 * A, (R - 0.1) * A, -0.06 * A, 0.06 * A, (R + 0.55) * A, 0.06 * A);
    h.rotateX(a); h.translate(wx * A, 0, 0); parts.push(h);
  }
  const wheel = meshOf(C.kit, finishLocal(parts), 'cedar', 'courts:golah-wheel');
  const pivot = new Object3D();
  pivot.name = 'wheel:azarah.chamber.golah';
  pivot.position.copy(m2w(cx, cyy, az));
  pivot.add(wheel);
  wheel.matrixAutoUpdate = true;
  pivot.userData = { kind: 'wheel', id: 'azarah.chamber.golah', axis: 'site X (world x)', angle: 0,
    spin(a) { pivot.userData.angle = a; wheel.rotation.x = a; return a; } };
  C.kit.group.add(pivot);
  C.ctx.movables.set(pivot.name, pivot);
  // rope and bucket down to the water
  C.kit.m('timber_rough', false, false).box([cx - 0.05, cyy + 0.5, waterZ + 0.6], [cx + 0.05, cyy + 0.6, az]);
  C.kit.geo(lathe([[0, 0], [0.35, 0], [0.42, 0.6], [0.38, 0.62], [0, 0.1]], [cx, cyy + 0.55, waterZ + 0.05], 10), 'copper', { collide: false });
  C.anchor('courts.chamber.golah', [cx, b.min[1] + t + 0.8, Z], 0, e.name.en);
}

// ------------------------------------------------------------------------------------- Etz / Parhedrin
function etz(C) {
  const e = C.el('azarah.chamber.etz'), b = e.box, dr = e.params.door;
  const Z = b.min[2], t = 1, hDoor = dr.z ? dr.z[1] - dr.z[0] : 16;
  shell(C, B(...b.min, ...b.max), { t, room: 'plaster', ceil: 'cedar', floor: 'paving_azarah', top: 'roof_plaster',
    doors: [B(dr.x[0], b.max[1] - t - 0.01, Z - 0.01, dr.x[1], b.max[1] + 0.01, Z + hDoor, { mat: 'marble_white' })] });
  // leaves hung half an amah inside the chel face, clear of the mezuzah in the outer tefach of the doorway
  C.doorPair('azarah.chamber.etz', 'cedarLeaf16', dr.x[0], dr.x[1], 'x', b.max[1] - 0.5, Z, [0, -1], { open: 0, h: hDoor });
  C.doorCase({ axis: 'y', at: b.max[1], out: 1, lo: dr.x[0], hi: dr.x[1], z0: Z, z1: Z + hDoor }, 0.8, 0.18);
  const fl = C.el('azarah.chamber.etz.flight');
  flight(C, { axis: 'y', head: b.max[1], dir: 1, c0: fl.box.min[0], c1: fl.box.max[0], steps: fl.params.steps, zTop: Z });
  // the only chamber with a mezuzah (Yoma 10a): on the right doorpost of one entering from the chel (the west jamb), in
  // the doorway's outer tefach (Menachot 33b), from the start of the upper third (Menachot 33a); a slim case proud of
  // the jamb face
  if (C.d >= 1) C.kit.m('cedar', false, false).box([dr.x[0], b.max[1] - 0.15, Z + hDoor * 2 / 3], [dr.x[0] + 0.08, b.max[1] - 0.04, Z + hDoor * 2 / 3 + 0.38]);
  // a dwelling: bed, table, chest, a lamp, a shelf and pegs ⚙ — the bed north-south (Rambam BhB 7:9 from Berachot 5b:
  // one sleeps only between north and south)
  const wood = C.kit.m('cedar', true, true), lin = C.kit.m('linen_white', false, true);
  wood.box([b.min[0] + t + 0.5, b.min[1] + t + 0.5, Z], [b.min[0] + t + 2.5, b.min[1] + t + 4.5, Z + 1.0]);
  lin.box([b.min[0] + t + 0.6, b.min[1] + t + 0.6, Z + 1.0], [b.min[0] + t + 2.4, b.min[1] + t + 4.4, Z + 1.25]);
  if (C.d >= 1) {
    // a shelf with two jugs on the east wall; pegs with a linen mantle on the west wall
    const xe = b.max[0] - t, xw = b.min[0] + t, shelfZ = Z + 3.6;
    wood.box([xe - 0.6, b.min[1] + t + 3.5, shelfZ], [xe, b.min[1] + t + 6.5, shelfZ + 0.12]);
    for (const y of [b.min[1] + t + 3.8, b.min[1] + t + 6.2]) C.kit.m('cedar', false, true).box([xe - 0.45, y - 0.06, shelfZ - 0.5], [xe, y + 0.06, shelfZ]);
    const jug = [[0, 0], [0.16, 0], [0.22, 0.1], [0.26, 0.35], [0.2, 0.58], [0.09, 0.7], [0.08, 0.86], [0.12, 0.9], [0, 0.88]];
    for (const y of [b.min[1] + t + 4.3, b.min[1] + t + 5.4]) C.kit.geo(lathe(jug, [xe - 0.3, y, shelfZ + 0.12], 10), C.kit.mat('terracotta', 'terrain_soil'), { collide: false });
    const peg = C.kit.m('cedar', false, true);
    for (const y of [b.min[1] + t + 6, b.min[1] + t + 7.2, b.min[1] + t + 8.4]) peg.beam([xw, y, Z + 4.4], [xw + 0.45, y, Z + 4.55], 0.1, 0.1);
    lin.box([xw + 0.12, b.min[1] + t + 5.5, Z + 2.4], [xw + 0.3, b.min[1] + t + 6.5, Z + 4.5]);
  }
  wood.box([b.min[0] + 12, b.min[1] + t + 3, Z], [b.min[0] + 16, b.min[1] + t + 5, Z + 1.6]);
  wood.box([b.max[0] - t - 4, b.min[1] + t + 0.3, Z], [b.max[0] - t - 1, b.min[1] + t + 1.8, Z + 1.4]);
  lampStand(C, 'courts.etz.lamp', b.min[0] + 10.5, b.min[1] + t + 1.5, Z, { schedule: 'night' });
  C.anchor('courts.chamber.etz', [(dr.x[0] + dr.x[1]) / 2, b.max[1] - t - 2, Z], 180, e.name.en);
  C.anchor('courts.gate.etz', [(dr.x[0] + dr.x[1]) / 2, b.max[1] + 2, Z], 180, 'Lishkat Parhedrin — its door to the chel');
}

// ------------------------------------------------------------------------------------------- south trio
function southTrio(C) {
  const Z = C.datums.azarah, t = 1;
  const med = C.el('azarah.chamber.medichin'), mes = med.params.mesibah.box;
  // the winding stair sized so a person passes (r 1.9 — a little past the site's 4 × 4 box) ⚙
  const sr = 1.9, sc = [mes.min[0] + 1 + sr + 0.05, mes.min[1] + 1 + sr + 0.05];
  for (const k of ['melach', 'parvah', 'medichin']) {
    const e = C.el(`azarah.chamber.${k}`), b = e.box;
    const w = Math.min(10, b.max[0] - b.min[0] - 6);
    const dx = k === 'medichin' ? b.max[0] - t - 1 - w / 2 : (b.min[0] + b.max[0]) / 2;
    const holes = k === 'medichin' ? [B(sc[0] - sr, sc[1] - sr, b.max[2] - 1.01, sc[0] + sr, sc[1] + sr, b.max[2] + 0.01, { mat: 'ashlar_plain' })] : [];
    const hDoor = e.params.door?.z ? e.params.door.z[1] - e.params.door.z[0] : 16;   // 16 unless site.js gives it
    shell(C, B(...b.min, ...b.max), { t, room: 'ashlar_plain', floor: 'paving_azarah', top: 'paving_azarah',
      doors: [B(dx - w / 2, b.max[1] - t - 0.01, Z - 0.01, dx + w / 2, b.max[1] + 0.01, Z + hDoor, { mat: 'marble_white' })], holes });
    C.doorPair(`azarah.chamber.${k}`, w >= 10 ? 'cedarLeaf16' : 'cedarLeaf16n', dx - w / 2, dx + w / 2, 'x', b.max[1] - 0.25, Z, [0, -1], { open: 1, h: hDoor });
    C.doorCase({ axis: 'y', at: b.max[1], out: 1, lo: dx - w / 2, hi: dx + w / 2, z0: Z, z1: Z + hDoor }, 0.8, 0.18);
    C.anchor(`courts.chamber.${k}`, [dx, b.max[1] - t - 3, Z], 180, e.name.en);
    const r = { min: [b.min[0] + t, b.min[1] + t, Z], max: [b.max[0] - t, b.max[1] - t, b.max[2] - t] };
    if (k === 'melach') saltStore(C, r);
    if (k === 'parvah') hides(C, r);
    if (k === 'medichin') rinsers(C, r, { max: [sc[0] + sr + 0.2] });
  }
  // Middot 5:3: "from it a winding stair goes up to the roof of the Parvah"
  spiral(C, { c: sc, r1: sr - 0.05, z0: Z, z1: med.box.max[2], perTurn: 13, a0: 0, mat: 'steps_stone' });
  // ---- the Parvah roof: the KG's Yom Kippur Beit HaTevilah, in kodesh (Yoma 31a; Middot 5:3); parapets round the roofs
  const pv = C.el('azarah.chamber.parvah'), pb = pv.box, wz = pv.params.roofMikveh.waterSurfaceZ, zr = pb.max[2];
  const mx0 = pb.min[0] + 5, mx1 = pb.max[0] - 5, my0 = pb.min[1] + 3, my1 = pb.max[1] - 3.5;
  const tank = B(mx0, my0, zr, mx1, my1, wz + 0.5, { top: 'ashlar_plain', side: 'ashlar_plain' });
  const tin = { min: [mx0 + 0.5, my0 + 0.5], max: [mx1 - 0.5, my1 - 0.5] };
  const wet = [];
  for (let c = 0; c < 5; c++) wet.push(B(tin.min[0] + 0.6 * c, tin.min[1], zr + 3 - 0.5 * c, tin.min[0] + 0.6 * (c + 1), tin.max[1], wz + 1, { room: 'plaster', floor: 'plaster' }));
  wet.push(B(tin.min[0] + 3, tin.min[1], zr, tin.max[0], tin.max[1], wz + 1, { room: 'plaster', floor: 'plaster' }));
  const outer = [];
  for (let j = 1; j <= 7; j++) outer.push(B(mx0 - 0.5 * (8 - j), my0 + 1, zr, mx0, my1 - 1, zr + 0.5 * j, { top: 'ashlar_plain', side: 'ashlar_plain' }));
  C.kit.solid(gridSolid([tank, ...outer], wet, classify), true, true);
  C.kit.m('water', false, false).box([tin.min[0], tin.min[1], wz], [tin.max[0], tin.max[1], wz], 'Z');
  // roof parapets of the Parvah–Medichin block (north, east, west edges)
  const x0 = pb.min[0], x1 = med.box.max[0], y1 = pb.max[1];
  const par = C.kit.m('ashlar_plain', true, true);
  par.box([x0, y1 - 0.4, zr], [x1, y1, zr + 2]);
  par.box([x0, pb.min[1], zr], [x0 + 0.4, y1 - 0.4, zr + 2]);
  par.box([x1 - 0.4, pb.min[1], zr], [x1, y1 - 0.4, zr + 2]);
  // the linen sheet spread between him and the people (Yoma 3:4) on poles along the north side: a movable,
  // 'curtain:azarah.chamber.parvah.screen', rolled to its poles except for his Yom Kippur immersions
  const pole = C.kit.m('cedar_v', false, true);
  for (const x of [mx0 - 3, mx1 + 0.5]) pole.box([x - 0.12, my1 + 0.6, zr], [x + 0.12, my1 + 0.84, zr + 5]);
  C.screen('azarah.chamber.parvah.screen', [mx0 - 3, my1 + 0.72, zr + 0.5], [1, 0], mx1 + 0.5 - (mx0 - 3), 4.3, "The Kohen Gadol's linen sheet (Parvah roof)");
  C.anchor('courts.parvah.roof-mikveh', [mx1 + 1.5, (my0 + my1) / 2, zr], 270, 'The Kohen Gadol\'s Beit HaTevilah on the Parvah roof');
}

function saltStore(C, r) {
  // heaps of salt in bins (Middot 5:3: salt for the korbanot)
  const z = r.min[2], stone = C.kit.m('ashlar_plain', true, true);
  for (let i = 0; i < 3; i++) {
    const x0 = r.min[0] + 0.5 + i * 6;
    stone.box([x0, r.min[1], z], [x0 + 5, r.min[1] + 0.4, z + 1.2]);
    C.kit.geo(lathe([[0, 0], [2.0, 0], [1.4, 0.6], [0.5, 1.15], [0, 1.25]], [x0 + 2.5, r.min[1] + 2.4, z], C.d >= 2 ? 18 : 10), 'plaster', { collide: true });
  }
}
function hides(C, r) {
  // racks with the hides of kodashim being salted (Middot 5:3): each hide hangs over a pole in two flaps, its outline a
  // flayed hide with leg flaps ⚙
  const z = r.min[2], wood = C.kit.m('cedar', false, true), hide = C.kit.m(C.kit.mat('leather', 'olive_wood'), false, true);
  const outline = [[0, 0], [2.0, 0], [2.15, -0.3], [1.95, -0.85], [2.2, -1.5], [1.85, -2.0], [1.05, -2.2], [0.2, -2.05], [-0.15, -1.5], [0.08, -0.85], [-0.12, -0.3]];
  let s = 5;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3; i++) {
    const y = r.min[1] + 1.5 + i * 3, zr = z + 3.4;
    wood.box([r.min[0] + 1, y - 0.1, z + 3.2], [r.max[0] - 1, y + 0.1, zr]);
    for (const x of [r.min[0] + 1, r.max[0] - 1.2]) wood.box([x, y - 0.1, z], [x + 0.2, y + 0.1, zr]);
    for (let k = 0; k < 6; k++) {
      const x0 = r.min[0] + 2 + k * 2.6, sc = 0.85 + rnd() * 0.25;
      for (const [side, len] of [[1, 1], [-1, 0.75 + rnd() * 0.15]]) {
        // a flap falls from the pole, hanging a little out from it
        const pts = outline.map(([u, v]) => [x0 + u * sc, y + side * (0.1 + -v * 0.12), zr + v * sc * len]);
        hide.poly(pts, [0, side, 0.2]);
        hide.poly(pts.map(([px, py, pz]) => [px, py - side * 0.02, pz]), [0, -side, -0.2]);
      }
    }
  }
}
function rinsers(C, r, mes) {
  // marble tables and a stone trough with running water for rinsing the innards (Middot 5:3) ⚙
  const z = r.min[2];
  const m = C.kit.m('marble_white', true, true);
  m.box([mes.max[0] + 0.5, r.min[1] + 1, z], [r.max[0] - 0.5, r.min[1] + 2.6, z + 1.6]);
  m.box([mes.max[0] + 0.5, r.min[1] + 5.5, z], [r.max[0] - 0.5, r.min[1] + 7, z + 1.6]);
  const trough = gridSolid([B(r.min[0] + 0.2, r.max[1] - 1.8, z, mes.max[0] - 0.2, r.max[1] - 0.2, z + 1.2, { top: 'marble_white', side: 'marble_white' })],
    [B(r.min[0] + 0.5, r.max[1] - 1.5, z + 0.4, mes.max[0] - 0.5, r.max[1] - 0.5, z + 1.3, { room: 'marble_white' })], classify);
  C.kit.solid(trough, true, true);
  C.kit.m('water', false, false).box([r.min[0] + 0.5, r.max[1] - 1.5, z + 1.0], [mes.max[0] - 0.5, r.max[1] - 0.5, z + 1.0], 'Z');
}

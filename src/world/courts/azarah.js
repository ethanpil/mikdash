// The Azarah gates (Middot 1:4–5, 2:3; Rambam BhB 5:4; lock #9; lock §58 stations) with their gold-plated doors,
// gate curtains (Yoma 54a) and exterior flights (32 half-steps, EK I 202–215); the Water Gate house with Beit Avtinas
// over it and the Kohen Gadol's first mikveh on its roof (Yoma 19a, 31a; Tamid 1:1); the Nitzotz exedra with
// Beit HaNitzotz above (Middot 1:5); Lishkat HaKelim (Shekalim 5:6; Tamid 3:4).
import { B, gridSolid, lathe } from './lib/geo.js';
import { shell, flight, spiral } from './lib/parts.js';
import { classify } from './masonry.js';

export function buildAzarah(C) {
  const Z_AZ = C.datums.azarah;
  // ---- the five N/S gates: doors, curtains, flights
  for (const key of ['delek', 'bechorot', 'mayim', 'nitzotz', 'korban']) {
    const e = C.el(`azarah.gate.${key}`), b = e.box, south = e.params.faces === 180;
    const outer = south ? b.min[1] : b.max[1], inner = south ? b.max[1] : b.min[1];
    const into = south ? [0, 1] : [0, -1];
    // Nitzotz: the gate stands in the back wall of its exedra (1 thick); others in the 5-amah wall
    const hingeY = key === 'nitzotz' ? outer - 0.25 : outer + into[1] * 0.25;
    // leaves as high as the opening they fold into: the Water Gate's passage is under its ½-amah marble roof and the
    // Nitzotz gate under the exedra's roof slab, so 20-amah leaves would rise through the roof terrace / upper floor
    const hLeaf = key === 'mayim' ? C.el('azarah.gate.mayim.house').params.roofZ - 0.5 - b.min[2] - 0.05
      : key === 'nitzotz' ? b.max[2] - 0.6 - b.min[2] - 0.05 : 20;
    C.doorPair(`azarah.gate.${key}`, 'goldLeaf', b.min[0], b.max[0], 'x', hingeY, b.min[2], into, { open: 1, label: e.name.en, h: hLeaf });
    // the parochet hangs on the court face, clear of the folded leaves; Nitzotz's leaves fold into its exedra, so its
    // curtain hangs on the chel face ⚙
    const curtainY = key === 'nitzotz' ? outer + 0.45 : inner + into[1] * 0.45;
    C.curtain(`azarah.gate.${key}`, [b.min[0] - 1, curtainY, b.min[2]], [1, 0], e.name.en);
    const f = C.el(`azarah.gate.${key}.flight`), fb = f.box;
    flight(C, { axis: 'y', head: outer, dir: south ? -1 : 1, c0: fb.min[0], c1: fb.max[0], steps: f.params.steps, zTop: fb.max[2] });
    const cx = (b.min[0] + b.max[0]) / 2;
    C.anchor(`courts.gate.${key}`, [cx, inner + into[1] * (key === 'nitzotz' ? 12 : 6), Z_AZ], south ? 180 : 0, e.name.en);
    C.anchor(`courts.gate.${key}.outside`, [cx, outer - into[1] * (f.params.steps * f.params.tread + 3), 0], south ? 0 : 180, `${e.name.en} — foot of its steps`);
  }
  waterGate(C);
  nitzotz(C);
  kelim(C);
}

// ------------------------------------------------------------------------------------------- Water Gate
function waterGate(C) {
  const Z_AZ = C.datums.azarah;
  const hse = C.el('azarah.gate.mayim.house'), hb = hse.box, g = C.el('azarah.gate.mayim').box;
  const zr = hse.params.roofZ;
  const t = 0.5;                                     // thin marble gatehouse (Yoma 31b) — leaves room for the stair
  // the house: passage (open N and S), two side rooms, doors between, a roof slab with the stair hole
  const pass = B(g.min[0], hb.min[1] - 0.01, Z_AZ, g.max[0], hb.max[1] + 0.01, zr - t, { room: 'marble_white', floor: 'marble_white', ceil: 'marble_white' });
  const wRoom = B(hb.min[0] + t, hb.min[1] + t, Z_AZ, g.min[0] - t, hb.max[1] - t, zr - t, { room: 'marble_white', floor: 'paving_azarah' });
  const eRoom = B(g.max[0] + t, hb.min[1] + t, Z_AZ, hb.max[0] - t, hb.max[1] - t, zr - t, { room: 'marble_white', floor: 'paving_azarah' });
  const cy = (hb.min[1] + hb.max[1]) / 2;
  const dW = B(g.min[0] - t - 0.01, cy - 1, Z_AZ, g.min[0] + 0.01, cy + 1, Z_AZ + 7, { mat: 'marble_white' });
  const dE = B(g.max[0] - 0.01, cy - 1, Z_AZ, g.max[0] + t + 0.01, cy + 1, Z_AZ + 7, { mat: 'marble_white' });
  // the spiral fills the east room's depth (r 1.95 — the site box's 3-amah width cannot pass a person) ⚙
  const sr = (hb.max[1] - hb.min[1]) / 2 - t - 0.05, sc = [hb.max[0] - t - sr - 0.05, (hb.min[1] + hb.max[1]) / 2];
  const hole = B(sc[0] - sr, sc[1] - sr, zr - t - 0.01, sc[0] + sr, sc[1] + sr, zr + 0.01, { mat: 'marble_white' });
  C.kit.solid(gridSolid([{ ...B(...hb.min, ...hb.max), top: 'paving_azarah', under: 'marble_white' }], [pass, wRoom, eRoom, dW, dE, hole], classify), true, true);
  // the spiral from the east room up through the roof: its top step faces the terrace walk ⚙ (unsourced access)
  // its last step points west onto the terrace walk
  spiral(C, { c: sc, r1: sr - 0.05, z0: Z_AZ, z1: zr, perTurn: 14, a0: Math.PI * (160 / 180) - (Math.round((zr - Z_AZ) / 0.5) - 0.5) * (2 * Math.PI / 14), mat: 'marble_white', newelMat: 'marble_white' });
  // ---- the roof terrace: Beit Avtinas (aliyah on the gate: Tamid 1:1; Rambam BhB 8:5) and the mikveh (Yoma 31a)
  const av = C.el('azarah.beit-avtinas').box;
  const walk = [hb.max[1] - 2.0, hb.max[1] - 0.4];              // the walkway along the court edge ⚙
  shell(C, B(...av.min, ...av.max), {
    t: 1, ty0: 0.6, ty1: 0.6, floor: 'paving_azarah', room: 'plaster', top: 'roof_plaster',
    doors: [
      B(av.max[0] - 1.01, walk[0] - 0.2, av.min[2], av.max[0] + 0.01, walk[1] - 0.05, av.min[2] + 6.5, { mat: 'ashlar_plain' }),
      // three windows toward the court (the watch over the Azarah) ⚙
      ...[0.25, 0.5, 0.75].map((f) => B(av.min[0] + f * (av.max[0] - av.min[0]) - 0.7, av.max[1] - 0.61, av.min[2] + 2.2, av.min[0] + f * (av.max[0] - av.min[0]) + 0.7, av.max[1] + 0.01, av.min[2] + 5.4, { mat: 'ashlar_plain' })),
    ],
  });
  // its door: a cedar leaf opening in (Middot 2:3 — every opening there had doors) ⚙
  C.doorSingle('azarah.beit-avtinas', 'cedarSmall', [av.max[0] - 0.2, walk[0] - 0.2, av.min[2]], [0, 1], [-1, 0], walk[1] - 0.05 - (walk[0] - 0.2), 6.5, { open: 1, label: 'Beit Avtinas' });
  avtinasInterior(C, av);
  // terrace parapets (ma'akeh) along both edges
  const par = C.kit.m('ashlar_plain', true, true);
  par.box([av.max[0], hb.max[1] - 0.4, zr], [hb.max[0], hb.max[1], zr + 2]);
  par.box([av.max[0], hb.min[1], zr], [hb.max[0], hb.min[1] + 0.4, zr + 2]);
  // the KG's first-immersion mikveh: water at gate head + 3 = the En-Eitam head (Yoma 31a); tank narrowed to keep
  // the walk to Beit Avtinas open ⚙
  const mk = C.el('azarah.mikveh.mayim-roof'), mb = mk.box, wz = mk.params.waterSurfaceZ;
  const tank = B(mb.min[0], mb.min[1], zr, Math.min(mb.max[0], sc[0] - sr - 0.05), walk[0], wz + 0.5);
  const tin = B(mb.min[0] + 0.4, mb.min[1] + 0.4, zr, tank.max[0] - 0.4, walk[0] - 0.4, wz + 1, { room: 'plaster', floor: 'plaster' });
  // the water space, carved as stepped columns: five steps down from the west rim; 3 amot of water (Yoma 31a)
  const wet = [];
  for (let c = 0; c < 5; c++) wet.push(B(tin.min[0] + 0.5 * c, tin.min[1], zr + 3 - 0.5 * c, tin.min[0] + 0.5 * (c + 1), tin.max[1], tin.max[2], { room: 'plaster', floor: 'plaster' }));
  wet.push(B(tin.min[0] + 2.5, tin.min[1], zr, tin.max[0], tin.max[1], tin.max[2], { room: 'plaster', floor: 'plaster' }));
  // steps up to the rim on its west side, rising south from the walk (one solid with the tank: no coplanar faces)
  const dj = (walk[0] - mb.min[1] - 0.2) / 7;
  const outerSteps = [];
  for (let j = 1; j <= 7; j++) outerSteps.push(B(mb.min[0] - 1.6, mb.min[1] + 0.1, zr, mb.min[0], walk[0] - 0.05 - (j - 1) * dj, zr + j * 0.5, { top: 'ashlar_plain', side: 'ashlar_plain' }));
  C.kit.solid(gridSolid([{ ...tank, top: 'ashlar_plain', side: 'ashlar_plain' }, ...outerSteps], wet, classify), true, true);
  C.kit.m('water', false, false).box([tin.min[0], tin.min[1], wz], [tin.max[0], tin.max[1], wz], 'Z');
  // the linen sheet spread between him and the people (Yoma 3:4; site params.screen): on poles on the court-side
  // parapet, 'curtain:azarah.mikveh.mayim-roof.screen' — rolled to the poles except for his Yom Kippur immersion
  const sx0 = mb.min[0] - 1.8, sx1 = tank.max[0] + 0.4, sy = hb.max[1] - 0.2, sz = zr + 2;
  const pole = C.kit.m('cedar_v', false, true);
  for (const x of [sx0, sx1]) pole.box([x - 0.12, sy - 0.12, sz], [x + 0.12, sy + 0.12, sz + 4.9]);
  C.screen('azarah.mikveh.mayim-roof.screen', [sx0, sy, sz + 0.2], [1, 0], sx1 - sx0, 4.5, "The Kohen Gadol's linen sheet (Water Gate roof)");
  C.anchor('courts.beit-avtinas', [av.max[0] - 3, (walk[0] + walk[1]) / 2, zr], 270, 'Beit Avtinas (over the Water Gate)');
  C.anchor('courts.mikveh.mayim-roof', [mb.max[0] + 0.3, (walk[0] + walk[1]) / 2, zr], 225, 'The Kohen Gadol\'s first mikveh (Water Gate roof)');
  C.anchor('courts.gate.mayim.house', [(g.min[0] + g.max[0]) / 2, cy, Z_AZ], 0, 'Water Gate passage');
}

/** Beit Avtinas: benches, a long worktable, stone mortars and spice jars (incense compounding — Yoma 38a) ⚙ */
function avtinasInterior(C, av) {
  const z = av.min[2];
  const wood = C.kit.m('cedar', true, true), stone = C.kit.m('ashlar_plain', true, true);
  wood.box([av.min[0] + 2, av.min[1] + 0.65, z], [av.max[0] - 4, av.min[1] + 1.55, z + 1.7]);
  for (let i = 0; i < 4; i++) {
    const x = av.min[0] + 3 + i * 3.6;
    C.kit.geo(lathe([[0, 0], [0.4, 0], [0.45, 0.7], [0.32, 0.8], [0.3, 0.45], [0, 0.45]], [x, av.min[1] + 1.1, z + 1.7], 12), 'marble_white', { collide: false });
  }
  if (C.d >= 1) {
    const key = C.kit.mat('terracotta', 'terrain_soil');
    for (let i = 0; i < 10; i++) C.kit.geo(lathe([[0, 0], [0.18, 0], [0.3, 0.3], [0.28, 0.75], [0.14, 0.95], [0.16, 1.05], [0, 1.05]], [av.min[0] + 1.5 + i * 1.7, av.max[1] - 1.1, z], 9), key, { collide: false });
  }
  stone.box([av.min[0] + 1.01, av.max[1] - 0.61 - 0.9, z], [av.min[0] + 9, av.max[1] - 0.61, z + 0.9]);
}

// ---------------------------------------------------------------------------------------- Sha'ar HaNitzotz
// "like an exedra, with an upper storey built on it; the kohanim keep watch above and the Levites below; it had a
// door to the chel" (Middot 1:5). Open colonnade toward the court ⚙; Beit HaNitzotz with open bays (F12).
function nitzotz(C) {
  const Z_AZ = C.datums.azarah;
  const ex = C.el('azarah.gate.nitzotz.exedra').box, up = C.el('azarah.beit-hanitzotz').box, g = C.el('azarah.gate.nitzotz').box;
  const zr = ex.max[2], t = 1;
  const x0 = ex.min[0], x1 = ex.max[0], yF = ex.min[1], yB = ex.max[1];
  const sr = 2.0, sc = [x1 - 1 - sr - 0.05, yB - 1 - sr - 0.05];
  const adds = [
    B(x0, yF, Z_AZ, x0 + t, yB, zr), B(x1 - t, yF, Z_AZ, x1, yB, zr),           // side walls
    B(x0, yB - t, Z_AZ, x1, yB, zr),                                             // back wall (the gate in it)
    { ...B(x0, yF, zr - 0.6, x1, yB, zr), top: 'paving_azarah', under: 'ashlar_plain' },   // roof = floor of Beit HaNitzotz
    { ...B(x0, yF, zr - 2.2, x1, yF + 1.5, zr - 0.6), side: 'marble_white', under: 'marble_white' },  // architrave over the columns
  ];
  // the newel stair stands in a thin stone turret in the exedra's NE corner, entered by a doorway at its foot ⚙
  const tt = 0.5, qx0 = sc[0] - sr - 0.05, qy0 = sc[1] - sr - 0.05;
  adds.push(B(qx0 - tt, qy0 - tt, Z_AZ, qx0, yB - t, zr - 0.6, { side: 'herodian_wall_inner' }),
    B(qx0 - tt, qy0 - tt, Z_AZ, x1 - t, qy0, zr - 0.6, { side: 'herodian_wall_inner' }));
  const td = [qx0 + 0.2, qx0 + 1.8];
  const subs = [
    { ...B(g.min[0], yB - t - 0.01, g.min[2], g.max[0], yB + 0.01, g.max[2] - 0.6), mat: 'marble_white' },
    B(sc[0] - sr, sc[1] - sr, zr - 2.3, sc[0] + sr, sc[1] + sr, zr + 0.01, { mat: 'ashlar_plain' }),
    B(td[0], qy0 - tt - 0.01, Z_AZ - 0.01, td[1], qy0 + 0.01, Z_AZ + 6, { mat: 'marble_white' }),
  ];
  C.kit.solid(gridSolid(adds, subs, classify), true, true);
  // four columns on the court side (stone exedras only in the Azarah: Rambam BhB 1:9)
  const cols = [-7.2, -2.4, 2.4, 7.2].map((dx) => (x0 + x1) / 2 + dx);
  for (const x of cols) C.column([x, yF + 0.75, Z_AZ], zr - 2.2 - Z_AZ, 0.88);
  // the first step rises just inside the turret's doorway (south-west), the stair turning anticlockwise; three full
  // turns bring the top step back over it, opening south onto the floor of Beit HaNitzotz
  spiral(C, { c: sc, r1: sr - 0.05, z0: Z_AZ, z1: zr, perTurn: 13, a0: (255 * Math.PI) / 180, mat: 'steps_stone' });
  C.doorCase({ axis: 'y', at: qy0 - tt, out: -1, lo: td[0], hi: td[1], z0: Z_AZ, z1: Z_AZ + 6 }, 0.45, 0.12);
  // Beit HaNitzotz: back wall in the N wall, open bays over the court with a 2-amah parapet ⚙
  const bays = [];
  const nb = 4, bw = (up.max[0] - up.min[0] - 2 * t - (nb - 1) * 1.2) / nb;
  for (let i = 0; i < nb; i++) {
    const bx0 = up.min[0] + t + i * (bw + 1.2);
    bays.push(B(bx0, up.min[1] - 0.01, up.min[2] + 2, bx0 + bw, up.min[1] + t + 0.01, up.max[2] - 2.5, { mat: 'marble_white' }));
  }
  shell(C, B(...up.min, ...up.max), { t, floor: 'paving_azarah', room: 'plaster', top: 'roof_plaster', doors: bays, holes: [] });
  C.anchor('courts.gate.nitzotz.exedra', [(x0 + x1) / 2 - 4, yF + 4, Z_AZ], 0, 'The Nitzotz exedra');
  C.anchor('courts.beit-hanitzotz', [(up.min[0] + up.max[0]) / 2 - 3, up.min[1] + 3, up.min[2]], 180, 'Beit HaNitzotz (upper storey)');
}

// ---------------------------------------------------------------------------------------- Lishkat HaKelim
function kelim(C) {
  const e = C.el('azarah.chamber.kelim'), b = e.box, dr = e.params.door;
  const t = 1;
  shell(C, B(...b.min, ...b.max), { t, room: 'plaster', floor: 'paving_azarah', top: 'roof_plaster',
    doors: [B(dr.x[0], b.min[1] - 0.01, dr.z[0] - 0.01, dr.x[1], b.min[1] + t + 0.01, dr.z[1], { mat: 'marble_white' })] });
  C.doorSingle('azarah.chamber.kelim', 'cedarSmall4x8', [dr.x[0], b.min[1] + 0.2, dr.z[0]], [1, 0], [0, 1], dr.x[1] - dr.x[0], dr.z[1] - dr.z[0], { open: 0.7 });
  C.doorCase({ axis: 'y', at: b.min[1], out: -1, lo: dr.x[0], hi: dr.x[1], z0: dr.z[0], z1: dr.z[1] }, 0.6, 0.16);
  // shelving for the vessels; the 93 gold and silver vessels of the day (Tamid 3:4) — a few shown ⚙
  const z = b.min[2], wood = C.kit.m('cedar', true, true);
  for (const zz of [z + 1.5, z + 3.2, z + 4.9]) wood.box([b.min[0] + t, b.max[1] - t - 1.4, zz], [b.max[0] - t, b.max[1] - t, zz + 0.15]);
  for (const zz of [z + 1.5, z + 3.2, z + 4.9]) wood.box([b.max[0] - t - 1.4, b.min[1] + t + 2, zz], [b.max[0] - t, b.max[1] - t - 1.4, zz + 0.15]);
  if (C.d >= 1) {
    const vessel = [[0, 0], [0.2, 0], [0.32, 0.15], [0.35, 0.45], [0.18, 0.62], [0.22, 0.75], [0, 0.72]];
    let i = 0;
    for (const zz of [z + 1.65, z + 3.35, z + 5.05]) for (let k = 0; k < 7; k++) {
      C.kit.geo(lathe(vessel, [b.min[0] + t + 0.7 + k * 1.2, b.max[1] - t - 0.7, zz], 10), i++ % 3 === 0 ? 'silver' : 'gold_vessel', { collide: false });
    }
  }
  C.anchor('courts.chamber.kelim', [(dr.x[0] + dr.x[1]) / 2, b.min[1] + t + 2.5, z], 0, e.name.en);
}

// Ezrat Nashim (Middot 2:5–2:6; Rambam BhB 5:7–9, 6:1–2, 6:6; Part II §4): the fifteen semicircular steps,
// the gezuztra (a timber gallery — Raavad's reading, Part VII §21 #5), the four unroofed corner chambers with
// their uses, Lishkat Chasha'im, the instrument cellars and the east gate's gold-plated doors.
import { B, lathe, latheLocal } from './lib/geo.js';
import { shell, logAt, starFire } from './lib/parts.js';
import { placeAt } from './lib/kit.js';
import { STATIONS } from '../../data/offerings.js';

export function buildEzratNashim(C) {
  steps15(C);
  gallery(C);
  cornerChambers(C);
  chashaim(C);
  musicCellars(C);
  eastGate(C);
  shofarot(C);
}

// ------------------------------------------------------------------------------------- the thirteen shofarot
// "Thirteen shofarot were in the Mikdash, and written on them: new shekels, old shekels, kinnin, gozlei olah, wood,
// frankincense, gold for the kaporet, and six for nedavah" (Shekalim 6:5–6). Shofarot: "chests whose mouth is narrow
// above, like a shofar whose mouth is narrow above and goes widening" (Bartenura, Shekalim 2:1) — so nothing could be
// drawn out. Their place is not given ("in the courts", report Part VI); offerings.js puts the kinnin chest in Ezrat
// Nashim by the steps (STATIONS['kinnin-chest'], where the yoledet may put in her money — Eruvin 32a, Kelim 1:8), and
// the thirteen stand together there: a ring in the Mishnah's order, so that the chests Shekalim 7:1–2 has money found
// "between" stand side by side — shekels and nedavah (the ring closes the six nedavah on the new shekels), wood and
// frankincense, kinnin and gozlei olah ⚙ (ring, size, cedar chest with a bronze horn). Clear of the metzora's way to
// his chamber and the Levites' way from the north music cellar (sim), and of the women's places (courts-daily).
// Static stone-court furniture in batches the courts already draw (cedar, cedar_v, iron, copper_worn — no draw calls
// added); anchors 'courts.en.shofar.<1-13>'. The labels follow the Sages where R' Yehudah differs (Shekalim 6:5); the
// minimum gifts are Shekalim 6:6 (as Menachot 13:3–4).
export const SHOFAROT = [
  ['tiklin-chadatin', 'New shekels (tiklin chadatin): the half-shekel of this year'],
  ['tiklin-atikin', 'Old shekels (tiklin atikin): one who did not give last year gives for the coming one'],
  ['kinnin', 'Kinnin: bird pairs — one chatat, one olah (the Sages)'],
  ['gozlei-olah', "Gozlei olah: birds that are all olot (the Sages; R' Yehudah: young pigeons)"],
  ['etzim', 'Wood (etzim): not less than two gizrin'],
  ['levonah', 'Frankincense (levonah): not less than a handful'],
  ['zahav', 'Gold for the kaporet: not less than a gold dinar'],
  ...[1, 2, 3, 4, 5, 6].map((k) => [`nedavah-${k}`, `Nedavah ${k} of 6: free-will offerings — olot, the flesh to God, the hides to the kohanim`]),
];
function shofarot(C) {
  const st = STATIONS['kinnin-chest']?.at || [285, 348, 6];
  const N = SHOFAROT.length, R = 2.6;                      // 1.26 amot apart round the ring, each chest facing its centre
  const k0 = SHOFAROT.findIndex(([id]) => id === 'kinnin');
  // the ring's centre lies south by east of the kinnin chest (−76°): the farthest from both of the metzora's legs past
  // it (1.15 amot from a chest's corner to either) ⚙
  const dir = [Math.cos(-76 * Math.PI / 180), Math.sin(-76 * Math.PI / 180)];
  const c = [st[0] + R * dir[0], st[1] + R * dir[1]], z = st[2];
  const a0 = Math.atan2(-dir[1], -dir[0]);                  // the kinnin chest's angle round the centre
  const wood = C.kit.m('cedar', true, true), lid = C.kit.m('cedar', false, true), panel = C.kit.m('cedar_v', false, true);
  const iron = C.kit.m('iron', false, false);
  // the horn: hammered copper darkened by handling, its rim rubbed bright by the coins (copper_worn — the polished
  // 'copper' read as the same salmon as the cedar; review)
  const HORN = C.kit.mat('copper_worn', 'copper');
  const horn = [[0, 0], [0.34, 0], [0.32, 0.06], [0.24, 0.2], [0.17, 0.38], [0.125, 0.58], [0.1, 0.78], [0.105, 0.84], [0.125, 0.88],
    [0.11, 0.905], [0.07, 0.89], [0.065, 0.75], [0, 0.75]];
  const seg = [8, 12, 16, 20][C.d] || 12;
  const H = 0.41;                                            // the body's half-width
  for (let i = 0; i < N; i++) {
    // counter-clockwise from the kinnin chest in the Mishnah's order
    const a = a0 + ((i - k0) * 2 * Math.PI) / N;
    const x = c[0] + R * Math.cos(a), y = c[1] + R * Math.sin(a);
    const X = i === k0 ? st[0] : x, Y = i === k0 ? st[1] : y;
    // the chest's own frame: +u out of the ring (the giver's side, the front), v along the ring, zc over the floor
    const ca = Math.cos(a), sa = Math.sin(a);
    const at = (u, v, zc) => [X + u * ca - v * sa, Y + u * sa + v * ca, z + zc];
    wood.boxRot(at(0, 0, 0.06), [0.9, 0.9, 0.12], a);
    wood.boxRot(at(0, 0, 0.71), [2 * H, 2 * H, 1.18], a);
    // the lid: a board overhanging the body 0.07 all round (its lip), a smaller board on it (z 1.30 … 1.40)
    lid.boxRot(at(0, 0, 1.33), [0.96, 0.96, 0.06], a);
    lid.boxRot(at(0, 0, 1.38), [0.88, 0.88, 0.04], a);
    // the label: "written on them" (Shekalim 6:5) — a framed field on the front, the frame 2 etzba'ot proud; the
    // writing is not drawn (no text textures) ⚙
    panel.boxRot(at(H + 0.002, 0, 0.67), [0.008, 0.54, 0.38], a);
    for (const s of [-1, 1]) {
      lid.boxRot(at(H + 0.005, 0, 0.67 + s * 0.2075), [0.03, 0.61, 0.035], a);
      lid.boxRot(at(H + 0.005, s * 0.2875, 0.67), [0.03, 0.035, 0.38], a);
    }
    // iron: corner angles and two bands round the body; on the front a hasp from the lid over a staple, with its lock;
    // two strap hinges at the back ⚙
    for (const [u, v] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) iron.boxRot(at(u * H, v * H, 0.71), [0.07, 0.07, 1.16], a);
    for (const zc of [0.305, 1.195]) iron.boxRot(at(0, 0, zc), [0.845, 0.845, 0.05], a);
    iron.boxRot(at(0.486, 0, 1.33), [0.012, 0.07, 0.06], a);          // over the lid's lip
    iron.boxRot(at(0.445, 0, 1.294), [0.082, 0.07, 0.012], a);        // under it, back to the body
    iron.boxRot(at(0.43, 0, 1.17), [0.012, 0.07, 0.26], a);           // down the face, over the band
    iron.boxRot(at(0.448, 0, 1.075), [0.03, 0.025, 0.03], a);         // the staple through its slot
    iron.boxRot(at(0.456, 0, 1.0), [0.035, 0.08, 0.075], a);          // the lock hanging from it
    for (const v of [-0.24, 0.24]) {
      iron.boxRot(at(-0.36, v, 1.406), [0.16, 0.055, 0.012], a);      // along the top board
      iron.boxRot(at(-0.446, v, 1.38), [0.012, 0.055, 0.04], a);      // down its edge
      iron.boxRot(at(-0.46, v, 1.366), [0.04, 0.055, 0.012], a);      // across the lip
      iron.boxRot(at(-0.486, v, 1.33), [0.012, 0.055, 0.06], a);      // down the lip
      iron.boxRot(at(-0.426, v, 1.21), [0.012, 0.055, 0.16], a);      // the leaf on the body
    }
    C.kit.geo(lathe(horn, [X, Y, z + 1.4], seg), HORN, { collide: false });
    const [id, what] = SHOFAROT[i];
    // the anchor: where one stands to put money in, on the ring's outside, facing the chest
    const sx = X + Math.cos(a) * 1.1, sy = Y + Math.sin(a) * 1.1;
    const head = (Math.atan2(X - sx, Y - sy) * 180) / Math.PI;
    C.anchor(`courts.en.shofar.${i + 1}`, [sx, sy, z], (head + 360) % 360, `Shofar ${i + 1} of 13 — ${what} (Shekalim 6:5–6)`, { chest: [X, Y, z + 2.3], label_id: id });
  }
}

// ------------------------------------------------------------------------------------- the fifteen steps
// "not straight-cornered but rounded like half a round threshing floor" (Middot 2:5); 15 × rise ½ (Rambam BhB 6:2)
function steps15(C) {
  const e = C.el('en.steps15'), p = e.params;
  const [cx, cy] = p.center;
  const n = [24, 40, 64, 96][C.d] || 40;
  const m = C.kit.m('steps_stone', true, true);
  const ang = (i) => -Math.PI / 2 + (Math.PI * i) / n;
  for (const st of p.stepRadii) {
    const r1 = st.rOuter, r0 = st.step === p.steps ? 0 : r1 - p.tread, zt = st.topZ, zb = zt - p.rise;
    for (let i = 0; i < n; i++) {
      const a0 = ang(i), a1 = ang(i + 1);
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      // riser (smooth radial normals)
      m.triN([cx + r1 * c0, cy + r1 * s0, zb], [cx + r1 * c1, cy + r1 * s1, zb], [cx + r1 * c1, cy + r1 * s1, zt], [c0, s0, 0], [c1, s1, 0], [c1, s1, 0]);
      m.triN([cx + r1 * c0, cy + r1 * s0, zb], [cx + r1 * c1, cy + r1 * s1, zt], [cx + r1 * c0, cy + r1 * s0, zt], [c0, s0, 0], [c1, s1, 0], [c0, s0, 0]);
      // tread
      if (r0 > 0) m.quadH([cx + r0 * c0, cy + r0 * s0, zt], [cx + r1 * c0, cy + r1 * s0, zt], [cx + r1 * c1, cy + r1 * s1, zt], [cx + r0 * c1, cy + r0 * s1, zt], [0, 0, 1]);
      else m.tri([cx, cy, zt], [cx + r1 * c0, cy + r1 * s0, zt], [cx + r1 * c1, cy + r1 * s1, zt]);
    }
  }
  // closed underneath: a down-facing half-disc a hair above the pavement, so the flight is a solid and the +6 floor
  // under it is not a standing place (physics/nav see zero clearance there; a teleport onto the steps lands on them)
  const zb0 = p.center[2] + 0.001, R = p.outerRadius;
  for (let i = 0; i < n; i++) {
    const a0 = ang(i), a1 = ang(i + 1);
    m.tri([cx, cy, zb0], [cx + R * Math.cos(a1), cy + R * Math.sin(a1), zb0], [cx + R * Math.cos(a0), cy + R * Math.sin(a0), zb0]);
  }
  C.anchor('courts.steps15.bottom', [cx + p.outerRadius + 3, cy, p.center[2]], 270, 'Foot of the fifteen steps');
  C.anchor('courts.steps15.top', [cx + 2.5, cy, e.box.max[2]], 270, 'Head of the fifteen steps (the Levites\' song)');
}

// ------------------------------------------------------------------------------------------- the gallery
// Gezuztra (Middot 2:5; Sukkah 51b–52a; Rambam BhB 5:9): balconies of timber (Raavad, Part VII §21 #5) cantilevered
// from the N, S and E walls between the corner chambers, open over the east gate; floor +16, parapet 2 amot ⚙.
function gallery(C) {
  const g = C.el('en.gallery'), gp = g.params;
  const fz = gp.floorZ;                          // walking surface
  const cedar = C.kit.m('cedar', false, true), deck = C.kit.m('cedar', true, true), post = C.kit.m('cedar_v', false, true);
  const rail = C.kit.m('cedar', true, true);
  // where each timber stair lands on its segment, the parapet stays open: [along0, along1] per segment
  const landings = { N: [302, 304.6], S: [302, 304.6], ES: [305, 307.6], EN: [353.4, 356] };
  const segs = gp.segments.map((s) => {
    // wall side: the face the segment touches (its outer edge at the EN wall line)
    if (s.max[1] === 398) return { box: s, axis: 'x', wall: 398, front: s.min[1], out: -1, gap: landings.N };
    if (s.min[1] === 263) return { box: s, axis: 'x', wall: 263, front: s.max[1], out: 1, gap: landings.S };
    return { box: s, axis: 'y', wall: 395, front: s.min[0], out: -1, gap: s.min[1] < C.axisY ? landings.ES : landings.EN };
  });
  const P = (sg, along, depth, z) => (sg.axis === 'x' ? [along, sg.wall + sg.out * depth, z] : [sg.wall + sg.out * depth, along, z]);
  const BX = (sg, a0, a1, d0, d1, z0, z1) => {
    const p = P(sg, a0, d0, z0), q = P(sg, a1, d1, z1);
    return [[Math.min(p[0], q[0]), Math.min(p[1], q[1]), z0], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), z1]];
  };
  for (const sg of segs) {
    const b = sg.box, depth = gp.depth;
    const a0 = sg.axis === 'x' ? b.min[0] : b.min[1], a1 = sg.axis === 'x' ? b.max[0] : b.max[1];
    // deck boards (the walking surface), ledger on the wall, front beam
    deck.box(...BX(sg, a0, a1, 0, depth, fz - 0.15, fz));
    cedar.box(...BX(sg, a0, a1, 0, 0.35, fz - 1.05, fz - 0.15));
    cedar.box(...BX(sg, a0, a1, depth - 0.4, depth, fz - 1.0, fz - 0.15));
    // joists every 2 amot, knee braces every 4
    const nj = Math.max(2, Math.round((a1 - a0) / 2));
    for (let i = 0; i <= nj; i++) {
      const a = a0 + 0.25 + ((a1 - a0 - 0.5) * i) / nj;
      cedar.box(...BX(sg, a - 0.2, a + 0.2, 0.35, depth - 0.4, fz - 0.8, fz - 0.15));
      if (i % 2 === 0) cedar.beam(P(sg, a, 0.15, fz - 4.2), P(sg, a, depth - 0.9, fz - 0.8), 0.32, 0.32);
      if (i % 2 === 0 && C.d >= 1) cedar.box(...BX(sg, a - 0.3, a + 0.3, 0, 0.3, fz - 4.6, fz - 3.9));   // stone-seated bearing block
    }
    // parapet: posts, rails and (detail ≥ 1) close-set vertical slats; detail 0: a boarded parapet — open where the
    // segment's stair lands
    const ph = gp.parapet, d1 = depth - 0.2;
    const runs = [[a0, Math.max(a0, sg.gap[0])], [Math.min(a1, sg.gap[1]), a1]].filter(([p, q]) => q - p > 0.3);
    for (const [r0, r1] of runs) {
      rail.box(...BX(sg, r0, r1, d1 - 0.15, d1 + 0.15, fz + ph - 0.22, fz + ph));
      if (C.d >= 1) {
        cedar.box(...BX(sg, r0, r1, d1 - 0.1, d1 + 0.1, fz, fz + 0.18));
        const np = Math.max(1, Math.round((r1 - r0) / 2.5));
        for (let i = 0; i <= np; i++) {
          const a = r0 + 0.2 + ((r1 - r0 - 0.4) * i) / np;
          post.box(...BX(sg, a - 0.14, a + 0.14, d1 - 0.14, d1 + 0.14, fz, fz + ph - 0.2));
        }
        const ns = Math.max(1, Math.round((r1 - r0) / 0.42));
        const slats = C.kit.m('cedar_v', true, false);
        for (let i = 0; i < ns; i++) {
          const a = r0 + 0.21 + ((r1 - r0 - 0.42) * i) / Math.max(1, ns - 1);
          slats.box(...BX(sg, a - 0.06, a + 0.06, d1 - 0.05, d1 + 0.05, fz + 0.18, fz + ph - 0.22));
        }
      } else rail.box(...BX(sg, r0, r1, d1 - 0.06, d1 + 0.06, fz, fz + ph - 0.22));
    }
  }
  // ---- the four timber stairs up to the gallery (access unsourced ⚙): along a corner-chamber wall, ½ × ½ like every
  // stair of the house (Middot 2:3), 20 risers +6 → +16, clear of the chambers' doors
  const en0 = C.datums.ezratNashim;
  const rise = 0.5, nR = Math.round((fz - en0) / rise), run = nR * 0.5;
  const stairs = [
    { axis: 'y', c: [302, 304], free: 1, from: 394 - run, to: 394 },     // N segment, along the lepers' chamber wall
    { axis: 'y', c: [302, 304], free: 1, from: 267 + run, to: 267 },     // S segment, along the oil chamber wall
    { axis: 'x', c: [305, 307], free: 1, from: 391 - run, to: 391 },     // E-S segment, along the nazirites' chamber wall
    { axis: 'x', c: [354, 356], free: 0, from: 391 - run, to: 391 },     // E-N segment, along the wood chamber wall
  ];
  for (const s of stairs) timberStair(C, s, en0, fz, nR);
  C.anchor('courts.en.gallery', [327.5, 396.2, fz], 180, 'The gezuztra — women\'s gallery (north)');
  C.anchor('courts.en.gallery.south', [327.5, 264.8, fz], 0, 'The gezuztra — south');
}

/** open timber stair: stringers, plank treads (colliders), a handrail on the open side */
function timberStair(C, { axis, c, free, from, to }, z0, z1, nR) {
  const tread = C.kit.m('cedar', true, true), wood = C.kit.m('cedar', false, true), post = C.kit.m('cedar_v', false, true);
  const dir = Math.sign(to - from), L = Math.abs(to - from);
  const P = (s, cc, z) => (axis === 'y' ? [cc, from + dir * s, z] : [from + dir * s, cc, z]);
  const bx = (s0, s1, c0, c1, zz0, zz1) => {
    const p = P(s0, c0, zz0), q = P(s1, c1, zz1);
    return [[Math.min(p[0], q[0]), Math.min(p[1], q[1]), zz0], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), zz1]];
  };
  const step = L / nR;
  for (let k = 0; k < nR; k++) tread.box(...bx(k * step, (k + 1) * step + 0.05, c[0] + 0.15, c[1] - 0.15, z0 + (k + 1) * 0.5 - 0.12, z0 + (k + 1) * 0.5));
  // stringers (sloped beams)
  for (const cc of [c[0] + 0.1, c[1] - 0.1]) wood.beam(P(0, cc, z0 + 0.1), P(L, cc, z1 - 0.3), 0.2, 0.8);
  // handrail on the free side (away from the chamber wall) and posts
  const hr = 2, cf = free ? c[1] - 0.05 : c[0] + 0.05;
  wood.beam(P(0, cf, z0 + 0.5 + hr), P(L, cf, z1 + hr), 0.18, 0.18);
  for (let k = 0; k <= 4; k++) {
    const s = (L * k) / 4, z = z0 + (s / L) * (z1 - z0);
    post.box(...bx(Math.max(0, s - 0.12), Math.min(L, s + 0.12) || s + 0.12, cf - 0.12, cf + 0.12, z, z + hr + 0.1));
  }
}

// --------------------------------------------------------------------------------- the four corner chambers
function cornerChambers(C) {
  const en0 = C.datums.ezratNashim;
  for (const k of ['wood', 'lepers', 'nazirites', 'oil']) {
    const e = C.el(`en.chamber.${k}`), b = e.box, p = e.params, t = p.innerWallT;
    const inner = B(b.min[0] === 260 ? b.min[0] : b.min[0] + t, b.min[1] === 263 ? b.min[1] : b.min[1] + t, b.min[2],
      b.min[0] === 260 ? b.max[0] - t : b.max[0], b.min[1] === 263 ? b.max[1] - t : b.max[1], b.max[2]);
    // door leaves: plain cedar, folding inward (all openings had doors — Middot 2:3) ⚙
    const dr = p.door, into = p.door.faceY === b.min[1] ? [0, 1] : [0, -1];
    const yFace = dr.faceY === b.min[1] ? b.min[1] : b.max[1];
    C.doorPair(`en.chamber.${k}`, 'cedarTall', dr.x[0], dr.x[1], 'x', yFace + into[1] * 0.2, dr.z[0], into, { open: 1, h: dr.z[1] - dr.z[0] });
    C.doorCase({ axis: 'y', at: yFace, out: -into[1], lo: dr.x[0], hi: dr.x[1], z0: dr.z[0], z1: dr.z[1] }, 0.8, 0.18);
    const cx = (inner.min[0] + inner.max[0]) / 2, cy = (inner.min[1] + inner.max[1]) / 2;
    C.anchor(`courts.en.chamber.${k}`, [cx, cy + (into[1] > 0 ? -12 : 12), en0], into[1] > 0 ? 0 : 180, e.name.en);
    if (k === 'wood') woodStore(C, inner);
    if (k === 'lepers') lepersMikveh(C, inner);
    if (k === 'nazirites') naziritesKitchen(C, inner);
    if (k === 'oil') oilStore(C, inner);
  }
}

/** a stacked log pile as a box: long faces + top in timber_pile, end faces in timber_pile_end (logs along `axis`) */
function logPile(C, min, max, axis) {
  const side = C.kit.m(C.kit.mat('timber_pile', 'timber_rough'), true, true), end = C.kit.m(C.kit.mat('timber_pile_end', 'timber_rough'), true, true);
  if (axis === 'x') { side.box(min, max, 'yYZ'); end.box(min, max, 'xX'); } else { side.box(min, max, 'xXZ'); end.box(min, max, 'yY'); }
}

/**
 * A log pile: at detail 0 the box; from detail 1 its exposed long faces (`exposed`: −1 / +1 on the cross axis) and its
 * top are a course of round logs laid end to end over a box core, so the silhouette and the log ends read as wood.
 */
function roundPile(C, min, max, axis, exposed, seed) {
  if (C.d < 1) { logPile(C, min, max, axis); return; }
  const r = 0.16, step = 2 * r;
  const ai = axis === 'x' ? 0 : 1, ci = 1 - ai;
  const lo = [...min], hi = [...max];
  if (exposed.includes(-1)) lo[ci] += r;
  if (exposed.includes(1)) hi[ci] -= r;
  hi[2] -= r;
  logPile(C, lo, hi, axis);
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const P = (a, c, zz) => (axis === 'x' ? [a, c, zz] : [c, a, zz]);
  const heading = axis === 'x' ? 90 : 0;
  const run = (c, zz) => {             // one row of logs laid end to end along the pile
    let a = min[ai] - 0.12 + rnd() * 0.24;
    while (a < max[ai] - 0.6) {
      const len = Math.min(max[ai] + 0.12 - a, 2.1 + rnd() * 1.3), rr = r * (0.82 + rnd() * 0.32);
      logAt(C, P(a + len / 2, c + (rnd() - 0.5) * 0.05, zz + (rr - r)), heading, len - 0.05, rr, { roll: rnd() * 6.283 });
      a += len;
    }
  };
  for (const side of exposed) {
    const c = side < 0 ? min[ci] + r : max[ci] - r;
    for (let zz = min[2] + r; zz <= hi[2] + 0.01; zz += step * 0.9) run(c, zz);
  }
  for (let c = min[ci] + r; c <= max[ci] - r + 0.01; c += step) run(c, hi[2] + rnd() * 0.05);
}

// NE — Lishkat Dir HaEtzim (Middot 2:5): wood stacked for the altar; blemished kohanim sort out wormy pieces.
function woodStore(C, r) {
  const z = r.min[2];
  // piles along the north and east walls, logs running along the walls
  for (let i = 0; i < 4; i++) roundPile(C, [r.min[0] + 2 + i * 8.5, r.max[1] - 4, z], [r.min[0] + 9.5 + i * 8.5, r.max[1] - 0.5, z + 3.2 - (i % 2) * 0.6], 'x', [-1], 10 + i);
  for (let i = 0; i < 3; i++) roundPile(C, [r.max[0] - 4, r.min[1] + 2 + i * 9, z], [r.max[0] - 0.5, r.min[1] + 9.5 + i * 9, z + 2.8 + (i % 2) * 0.5], 'y', [-1], 20 + i);
  // the sorting floor: a low pile and scattered logs (detail ≥ 1)
  roundPile(C, [r.min[0] + 12, r.min[1] + 16, z], [r.min[0] + 17, r.min[1] + 18.5, z + 1.2], 'x', [-1, 1], 30);
  if (C.d >= 1) {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 14; i++) {
      const x = r.min[0] + 10 + rnd() * 16, y = r.min[1] + 10 + rnd() * 14, h = rnd() * 180, l = 1.6 + rnd() * 1.2, rr = 0.13 + rnd() * 0.06;
      logAt(C, [x, y, z + rr], h, l, rr, { roll: rnd() * 6.283 });
    }
  }
  // Shekalim 6:2: "a paving block different from its fellows" — the tradition of the Aron hidden beneath this chamber
  if (C.d >= 1) C.kit.m('marble_veined', false, false).box([r.min[0] + 19, r.min[1] + 21, z], [r.min[0] + 20.5, r.min[1] + 22, z + 0.012], 'Z');
}

// NW — Lishkat HaMetzora'im (Middot 2:5): the healed metzora immerses on his eighth day — a stepped, plastered mikveh
// (≥ amah × amah × 3 of water: Yoma 31a) ⚙ size and place.
function lepersMikveh(C, r) {
  const z = r.min[2];
  const x0 = r.min[0] + 12, x1 = x0 + 6, y0 = r.min[1] + 20, y1 = y0 + 8;
  const water = z - 0.75, bottom = water - 3;       // three amot of water
  // carved out of the court's fill as stepped rows: seven half-steps down from the south edge, plastered
  for (let r0 = 0; r0 < 7; r0++) C.floorHoles.push(B(x0, y0 + r0, z - 0.5 * (r0 + 1), x1, y0 + r0 + 1, z + 0.01, { room: 'plaster', floor: 'plaster' }));
  C.floorHoles.push(B(x0, y0 + 7, bottom, x1, y1, z + 0.01, { room: 'plaster', floor: 'plaster' }));
  C.kit.m('water', false, false).box([x0, y0, water], [x1, y1, water], 'Z');
  // a low kerb on three sides of the pool
  const kerb = C.kit.m('ashlar_plain', true, true);
  kerb.box([x0 - 0.5, y1, z], [x1 + 0.5, y1 + 0.5, z + 0.6]);
  kerb.box([x0 - 0.5, y0 + 1, z], [x0, y1, z + 0.6]);
  kerb.box([x1, y0 + 1, z], [x1 + 0.5, y1, z + 0.6]);
  // benches along the west wall
  for (let i = 0; i < 2; i++) kerb.box([r.min[0] + 0.01, r.min[1] + 6 + i * 16, z], [r.min[0] + 1.5, r.min[1] + 16 + i * 16, z + 1]);
  C.anchor('courts.en.lepers-mikveh', [x0 + 3, y0 - 3, z], 0, 'Mikveh of the metzora\'im');
}

// SE — Lishkat HaNezirim (Middot 2:5): the nazirites cook their shelamim and cast the hair under the pot.
function naziritesKitchen(C, r) {
  const z = r.min[2];
  const stone = C.kit.m('ashlar_plain', true, true), sup = C.kit.m('ashlar_plain', false, true);
  // a raised hearth bench along the east wall with three fire-pits
  const x1 = r.max[0], x0 = x1 - 3, zb = z + 1.4;
  stone.box([x0, r.min[1] + 8, z], [x1, r.min[1] + 30, zb]);
  const pits = [r.min[1] + 12, r.min[1] + 19, r.min[1] + 26];
  const potProf = [[0, 0], [0.5, 0], [0.85, 0.25], [0.95, 0.7], [0.85, 1.1], [0.9, 1.2], [0.75, 1.2], [0, 1.2]];
  const potZ = zb + 0.95;                         // each pot stands on three hearth stones, clear of the fire beneath ⚙
  pits.forEach((y, i) => {
    const px = x0 + 1.5;
    C.kit.geo(lathe([[0.95, 0], [1.15, 0], [1.15, 0.3], [0.95, 0.3]], [px, y, zb], 12), 'ashlar_plain', { collide: false });
    C.kit.geo(lathe([[0, 0.01], [0.95, 0.01], [0.8, 0.07], [0, 0.09]], [px, y, zb], 12), 'ash', { collide: false, castShadow: false });
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 + i * 0.7;
      sup.boxRot([px + Math.cos(a) * 0.62, y + Math.sin(a) * 0.62, zb + 0.475], [0.42, 0.34, 0.95], a);
    }
    C.kit.geo(lathe(potProf, [px, y, potZ], C.d >= 2 ? 16 : 10), C.kit.mat('copper_worn', 'copper'), { collide: false });
    // sticks pushed in between the stones under every pot; each set of offerings cooks at its own pit (Nazir 6:8–9).
    // The middle pit keeps its id and schedule ('courts.en.nazirites.hearth', 'day' — the sim states its level all day);
    // the others (world-4) are 'courts.en.nazirites.hearth.0' (Y 275) and '.2' (Y 289): 'service', dark until a set cooks
    starFire(C, [px, y], zb + 0.06, zb + 0.2, 0.85, 3, [17, 7, 27][i] ?? 7, 0.1);
    if (i === 1) C.ctx.addFire({ id: 'courts.en.nazirites.hearth', kind: 'hearth', pos: [px, y, zb + 0.08], size: 0.3, intensity: 0.75, schedule: 'day', smoke: true });
    else C.ctx.addFire({ id: `courts.en.nazirites.hearth.${i}`, kind: 'hearth', pos: [px, y, zb + 0.08], size: 0.3, intensity: 0, schedule: 'service', smoke: true });
  });
  // a table for the shaving and stone benches
  stone.box([r.min[0] + 14, r.min[1] + 16, z], [r.min[0] + 18, r.min[1] + 18, z + 1.6]);
  for (let i = 0; i < 2; i++) stone.box([r.min[0] + 6 + i * 20, r.min[1] + 0.01, z], [r.min[0] + 14 + i * 20, r.min[1] + 1.4, z + 0.9]);
}

// SW — Lishkat Beit Shamanya (Middot 2:5, Abba Shaul): wine and oil stores — rows of storage jars.
function oilStore(C, r) {
  const z = r.min[2];
  const key = C.kit.mat('terracotta', 'terrain_soil');
  // flat-based storage jars (pithoi) for wine and oil, and smaller jugs — period forms, sizes ⚙
  C.kit.set('pithoi', () => latheLocal([[0, 0], [0.42, 0], [0.5, 0.08], [0.62, 0.45], [0.68, 1.0], [0.6, 1.55], [0.35, 1.92], [0.22, 2.0], [0.27, 2.12], [0.2, 2.15], [0, 2.05]], C.d >= 2 ? 16 : 10), key);
  C.kit.set('jugs', () => latheLocal([[0, 0], [0.2, 0], [0.26, 0.1], [0.32, 0.45], [0.27, 0.75], [0.12, 0.92], [0.1, 1.12], [0.15, 1.16], [0, 1.12]], C.d >= 2 ? 12 : 8), key);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // rows along the west and south walls with a working aisle, as a store is laid out
  for (let i = 0; i < 16; i++) C.kit.inst('pithoi', placeAt(r.min[0] + 1.1 + (i % 2) * 1.45, r.min[1] + 2 + Math.floor(i / 2) * 1.45 + (i % 2) * 0.72, z, rnd() * 360, 0.95 + rnd() * 0.08));
  for (let i = 0; i < 14; i++) C.kit.inst('pithoi', placeAt(r.min[0] + 6 + i * 1.45, r.min[1] + 1.1 + (i % 2) * 1.3, z, rnd() * 360, 0.95 + rnd() * 0.08));
  for (let i = 0; i < 18; i++) C.kit.inst('jugs', placeAt(r.min[0] + 8 + (i % 9) * 0.75, r.min[1] + 14 + Math.floor(i / 9) * 0.8, z, rnd() * 360, 0.9 + rnd() * 0.15));
  // a stone counter for measuring out
  C.kit.m('ashlar_plain', true, true).box([r.min[0] + 24, r.min[1] + 4, z], [r.min[0] + 34, r.min[1] + 6, z + 1.8]);
}

// ---------------------------------------------------------------------------------------- Lishkat Chasha'im
// Shekalim 5:6 — gifts given and taken in secret; nominal box built into the N wall under the gallery (lock §58 ⚙).
function chashaim(C) {
  const e = C.el('en.chamber.chashaim'), b = e.box, dr = e.params.door;
  const box = B(b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2] - 0.2);  // roof under the gallery deck
  const t = 1;
  shell(C, box, { t, floor: 'paving_mount', room: 'plaster', top: 'ashlar_plain',
    doors: [B(dr.x[0], b.min[1] - 0.01, dr.z[0], dr.x[1], b.min[1] + t + 0.01, dr.z[1], { mat: 'ashlar_plain' })] });
  C.doorSingle('en.chamber.chashaim', 'cedarSmall', [dr.x[0], b.min[1] + 0.2, dr.z[0]], [1, 0], [0, 1], dr.x[1] - dr.x[0], dr.z[1] - dr.z[0], { open: 0.6 });
  // a chest with a slot and a table inside
  const wood = C.kit.m('cedar', true, true);
  wood.box([b.min[0] + 3, b.max[1] - 3, b.min[2]], [b.min[0] + 6, b.max[1] - 1.2, b.min[2] + 1.6]);
  wood.box([b.max[0] - 6, b.min[1] + 2.5, b.min[2] + 1.5], [b.max[0] - 2, b.min[1] + 4.5, b.min[2] + 1.7]);
  C.anchor('courts.en.chashaim', [(dr.x[0] + dr.x[1]) / 2, b.min[1] - 3, b.min[2]], 0, e.name.en);
}

// -------------------------------------------------------------------------------- the instrument cellars
// Middot 2:6: chambers under Ezrat Yisrael opening onto Ezrat Nashim, where the Levites kept kinnorot, nevalim,
// metziltayim and all the instruments of song.
function musicCellars(C) {
  const e = C.el('en.music-chambers');
  const wood = C.kit.m('cedar', true, true), wv = C.kit.m('cedar_v', false, true);
  for (const r of e.params.rooms) {
    const b = r.box, z = b.min[2], d = r.door;
    // racks along both long walls (N–S), two shelves; the rack on the door wall stops an amah short of the doorway
    const full = [b.min[1] + 2, b.max[1] - 2];
    const doorWall = (d.max[1] - full[0]) > (full[1] - d.min[1])
      ? [full[0], Math.min(full[1], d.min[1] - 1)] : [Math.max(full[0], d.max[1] + 1), full[1]];
    for (const [x, [ya, yb]] of [[b.min[0] + 0.05, full], [b.max[0] - 1.45, doorWall]]) {
      for (const zz of [z + 1.6, z + 3.4]) wood.box([x, ya, zz], [x + 1.4, yb, zz + 0.15]);
      for (let i = 0; i <= 6; i++) wv.box([x + 0.55, ya + i * ((yb - ya) / 6) - (i === 6 ? 0.2 : i ? 0.1 : 0), z], [x + 0.85, ya + i * ((yb - ya) / 6) + (i === 0 ? 0.2 : i < 6 ? 0.1 : 0), z + 3.55]);
      if (C.d >= 1) {
        // lyres (kinnorot) and harps (nevalim) on the racks: soundbox, arms, yoke ⚙ forms after period depictions
        for (let i = 0; i < 8; i++) {
          const y = ya + 1 + i * ((yb - ya - 2) / 7), zz = i % 2 ? z + 1.75 : z + 3.55;
          wood.box([x + 0.4, y - 0.35, zz], [x + 1.0, y + 0.35, zz + 0.45]);
          wood.beam([x + 0.7, y - 0.3, zz + 0.4], [x + 0.7, y - 0.45, zz + 1.4], 0.08, 0.08);
          wood.beam([x + 0.7, y + 0.3, zz + 0.4], [x + 0.7, y + 0.45, zz + 1.4], 0.08, 0.08);
          wood.beam([x + 0.7, y - 0.5, zz + 1.35], [x + 0.7, y + 0.5, zz + 1.35], 0.08, 0.08);
        }
      }
    }
    // the door: a cedar leaf swinging in
    const side = r.side.toLowerCase();
    C.doorSingle(`en.music-chambers.${side}`, 'cedarSmall', [d.max[0] - 0.2, d.min[1], d.min[2]], [0, 1], [-1, 0], d.max[1] - d.min[1], d.max[2] - d.min[2], { open: 0.85 });
    C.anchor(`courts.en.music-${side}`, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, z], 0, `${e.name.en} (${r.side})`);
  }
}

// ----------------------------------------------------------------------------------------- the east gate
function eastGate(C) {
  const g = C.el('en.gate.east').box;
  C.doorPair('en.gate.east', 'goldLeaf', g.min[1], g.max[1], 'y', g.max[0] - 0.25, g.min[2], [-1, 0], { open: 1, label: 'East gate of Ezrat Nashim' });
  C.anchor('courts.gate.en-east', [g.min[0] - 3, (g.min[1] + g.max[1]) / 2, g.min[2]], 270, 'East gate of Ezrat Nashim');
  C.anchor('courts.en.center', [327.5, (g.min[1] + g.max[1]) / 2 - 8, g.min[2]], 270, 'Ezrat Nashim');
}

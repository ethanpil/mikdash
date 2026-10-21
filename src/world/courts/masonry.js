// Court walls, floors, cornices and gate frames (Middot 2:3–2:6; Part VII §21 #5–#10, §25; lock §58).
// Everything here is site-driven: wall boxes, openings, voids, cutouts and replaced spans come from site.js
// params; the reconstruction choices (cornice profile, frames, window set) are logged in
// docs/decisions/build-courts.md.
import { gridSolid, B, EB, isect, inside, sweep } from './lib/geo.js';
import { courseRuns } from '../materials/courses.js';

/** the Herodian wall keys on the materials' course table (1.00–1.20 m courses; world-4): outer faces and the dressed
 *  inner faces. The modelled set-out courses follow ctx.mats.courseAt (materials/courses.js courseRuns). */
export const WALL = 'herodian_wall_courses', WALL_IN = 'herodian_wall_inner_courses';

/** court interiors (above their floors): faces looking into them are the dressed inner faces */
export const COURT_IN = [B(260, 263, -50, 395, 398, 300), B(68, 263, -50, 255, 398, 300)];
/** rooms bounded by another solid's faces (e.g. the music cellars against the Nikanor wall): { min, max, mat } */
export const ROOMS = [];

/** probe point just outside a grid face */
export const probe = (f, d = 0.01) => { const p = [f.center[0], f.center[1], f.center[2]]; p[f.axis] += f.dir * d; return p; };

/**
 * Shared face classifier. Tags on subs: mat (reveal of an opening, all faces), room (interior walls), floor/ceil
 * (horizontal faces inside the sub). Tags on adds: top, under, side.
 */
export function classify(f) {
  const s = f.sub;
  if (f.axis === 2) {
    if (s) {
      if (f.dir > 0 && s.floor) return s.floor;
      if (f.dir < 0 && s.ceil) return s.ceil;
      if (s.mat) return s.mat;
      if (s.room) return s.room;
    }
    return f.dir > 0 ? (f.add?.top || 'ashlar_plain') : (f.add?.under || 'ashlar_plain');
  }
  if (s?.mat) return s.mat;
  if (s?.room) return s.room;
  if (f.add?.side) return f.add.side;
  const p = probe(f);
  for (const r of ROOMS) if (inside(r, p)) return r.mat;
  return COURT_IN.some((b) => inside(b, p)) ? WALL_IN : WALL;
}

/** wall ∩ box as a sub (keeps tags) */
const cut = (wall, box, tags) => { const i = isect(wall, box); return i ? { ...i, ...tags } : null; };

export function buildMasonry(C) {
  const { el, kit, d } = C;
  ROOMS.length = 0;
  for (const r of el('en.music-chambers').params.rooms) ROOMS.push({ ...r.box, mat: 'ashlar_plain' });
  const Z_AZ = C.datums.azarah;
  const walls = {
    enN: EB(el('en.wall.north')), enS: EB(el('en.wall.south')), enE: EB(el('en.wall.east')),
    azE: EB(el('azarah.wall.east')), azN: EB(el('azarah.wall.north')), azS: EB(el('azarah.wall.south')), azW: EB(el('azarah.wall.west')),
  };
  const adds = Object.values(walls);
  const subs = [];
  const push = (s) => { if (s) subs.push(s); };
  const MARBLE = 'marble_white';
  // ---- EN corner chambers: their two inner walls (Middot 2:5; 2 thick ⚙ to +28) with a door to the court
  for (const k of ['nazirites', 'wood', 'lepers', 'oil']) {
    const e = el(`en.chamber.${k}`), p = e.params, b = e.box, t = p.innerWallT;
    const xIn = b.min[0] === 260 ? [b.max[0] - t, b.max[0]] : [b.min[0], b.min[0] + t]; // inner wall toward the court (x)
    const yIn = b.min[1] === 263 ? [b.max[1] - t, b.max[1]] : [b.min[1], b.min[1] + t];
    adds.push(B(xIn[0], b.min[1], b.min[2], xIn[1], b.max[1], b.max[2]));
    adds.push(B(b.min[0], yIn[0], b.min[2], b.max[0], yIn[1], b.max[2]));
    const dr = p.door;
    push(B(dr.x[0], yIn[0], dr.z[0], dr.x[1], yIn[1], dr.z[1], { mat: MARBLE }));
  }
  // ---- openings (gates) — marble reveals and thresholds (gatehouses of marble: Yoma 31b)
  for (const id of ['en.gate.east', 'azarah.gate.nikanor', 'azarah.gate.delek', 'azarah.gate.bechorot', 'azarah.gate.nitzotz', 'azarah.gate.korban']) {
    push({ ...EB(el(id)), mat: MARBLE });
  }
  // ---- voids (rooms within the wall thickness; their shells are built by their owners)
  const room = 'ashlar_plain';
  for (const [wallKey, id, tags] of [
    ['enN', 'en.chamber.chashaim', { room, floor: 'paving_mount' }],
    ['azE', 'azarah.chamber.pinchas', { room, floor: 'paving_azarah' }],
    ['azE', 'azarah.chamber.chavitin', { room, floor: 'paving_azarah' }],
    ['azN', 'azarah.gate.nitzotz.exedra', { room: WALL_IN, floor: 'paving_azarah' }],
    ['azN', 'azarah.beit-hanitzotz', { room }],
    ['azN', 'azarah.chamber.etz', { room, floor: 'paving_azarah' }],
    ['azN', 'azarah.chamber.kelim', { room, floor: 'paving_azarah' }],
    ['azS', 'azarah.gate.mayim.house', { room: MARBLE, floor: MARBLE }],
  ]) push(cut(walls[wallKey], EB(el(id)), tags));
  // ---- replaced spans (full height): Beit HaMoked (N), Lishkat HaGazit (W)
  push(cut(walls.azN, { min: [el('azarah.moked.hall').box.min[0], walls.azN.min[1], -100], max: [el('azarah.moked.hall').box.max[0], walls.azN.max[1], 300] }, {}));
  push(cut(walls.azW, { min: [walls.azW.min[0], el('azarah.chamber.gazit').box.min[1], -100], max: [walls.azW.max[0], el('azarah.chamber.gazit').box.max[1], 300] }, {}));
  // ---- cutouts: the S wall lowered to the Water Gate house roof (terrace for Beit Avtinas and the mikveh)
  for (const c of el('azarah.wall.south').params.cutouts || []) push({ ...c.box, floor: 'paving_azarah' });
  // ---- the music-chamber doors through the Nikanor wall (alsoPierces)
  for (const r of el('en.music-chambers').params.rooms) push({ ...r.door, mat: 'ashlar_plain' });
  // ---- F5 windows (Zevachim 56a: attested collectively, positions unstated ⚙): one high window per bay
  const windows = [];
  const zw0 = Z_AZ + 28, zw1 = Z_AZ + 33, ww = 1.25;
  const gx = C.gateX; // gate centre X on N/S walls
  const nsCentres = [(68 + gx[0] - 5) / 2, (gx[0] + 5 + gx[1] - 5) / 2];
  for (const x of nsCentres) {
    windows.push(B(x - ww, walls.azN.min[1], zw0, x + ww, walls.azN.max[1], zw1, { mat: 'ashlar_plain', face: 'N' }));
    windows.push(B(x - ww, walls.azS.min[1], zw0, x + ww, walls.azS.max[1], zw1, { mat: 'ashlar_plain', face: 'S' }));
  }
  const nMid3 = (gx[1] + 5 + el('azarah.moked.hall').box.min[0]) / 2;
  windows.push(B(nMid3 - ww, walls.azN.min[1], zw0, nMid3 + ww, walls.azN.max[1], zw1, { mat: 'ashlar_plain', face: 'N' }));
  const sMid3 = (gx[1] + 5 + el('azarah.gate.mayim.house').box.min[0]) / 2;
  windows.push(B(sMid3 - ww, walls.azS.min[1], zw0, sMid3 + ww, walls.azS.max[1], zw1, { mat: 'ashlar_plain', face: 'S' }));
  const nMid4 = (el('azarah.moked.hall').box.max[0] + 255) / 2, sMid4 = (el('azarah.gate.mayim.house').box.max[0] + 255) / 2;
  windows.push(B(nMid4 - ww, walls.azN.min[1], zw0, nMid4 + ww, walls.azN.max[1], zw1, { mat: 'ashlar_plain', face: 'N' }));
  windows.push(B(sMid4 - ww, walls.azS.min[1], zw0, sMid4 + ww, walls.azS.max[1], zw1, { mat: 'ashlar_plain', face: 'S' }));
  const gz0 = el('azarah.chamber.gazit').box.min[1];
  for (const y of [263 + (gz0 - 263) / 3, 263 + 2 * (gz0 - 263) / 3]) windows.push(B(walls.azW.min[0], y - ww, zw0, walls.azW.max[0], y + ww, zw1, { mat: 'ashlar_plain', face: 'W' }));
  subs.push(...windows);
  C.windows = windows;

  // ---- apik shefa v'a'eil shefa (Bava Batra 4a): alternate courses set out 1 etzba on the outer faces (detail ≥ 2) —
  // the courses the materials' course table sets out (whole courses only), so the steps meet the baked joints
  if (d >= 2) {
    const out = 1.5 / 24;                                                        // 1½ etzba'ot ⚙
    const fringe = [];
    const faceRuns = [
      // [axis of the face normal, sign, plane coordinate, along-range, z-top]
      ['y', -1, walls.azS.min[1], [walls.azS.min[0], walls.azS.max[0]], walls.azS.max[2]],
      ['y', -1, walls.enS.min[1], [walls.enS.min[0], walls.enS.max[0]], walls.enS.max[2]],
      // (the low E wall's ends are buried in the N/S walls, which run through the corner squares to X 260)
      ['x', 1, walls.enS.max[0], [walls.enS.min[1], walls.enS.max[1]], walls.enS.max[2]],
      ['x', 1, walls.enN.max[0], [walls.enN.min[1], walls.enN.max[1]], walls.enN.max[2]],
      ['y', 1, walls.azN.max[1], [walls.azN.min[0], walls.azN.max[0]], walls.azN.max[2]],
      ['y', 1, walls.enN.max[1], [walls.enN.min[0], walls.enN.max[0]], walls.enN.max[2]],
      ['x', -1, walls.azW.min[0], [walls.azS.min[1], walls.azN.max[1]], walls.azW.max[2]],
      ['x', 1, walls.enE.max[0], [walls.enE.min[1], walls.enE.max[1]], walls.enE.max[2]],
    ];
    for (const [ax, s, at, [r0, r1], ztop] of faceRuns) {
      for (const run of courseRuns(C.ctx.mats, WALL, 0, ztop - 1.3)) {
        if (!run.setOut || !run.whole) continue;
        const { z0, z1 } = run;
        if (ax === 'y') fringe.push(B(r0, s < 0 ? at - out : at, z0, r1, s < 0 ? at : at + out, z1));
        else fringe.push(B(s < 0 ? at - out : at, r0, z0, s < 0 ? at : at + out, r1, z1));
      }
    }
    // the fringe goes into its own solid (thin slabs), cut by the same openings
    // openings, cutouts and replaced spans are widened past the set-out depth; rooms in the wall (voids) are not,
    // so the courses run on over the flush outer faces of the chambers built in the wall
    const grow = (b, g = 0.2) => (b.room ? b : { ...b, min: [b.min[0] - g, b.min[1] - g, b.min[2]], max: [b.max[0] + g, b.max[1] + g, b.max[2]] });
    const etzDoor = el('azarah.chamber.etz').params.door;
    const fr = gridSolid(fringe, subs.map((b) => grow(b)).concat([
      B(etzDoor.x[0], walls.azN.max[1] - 1, Z_AZ, etzDoor.x[1], walls.azN.max[1] + 1, Z_AZ + 20),
      grow(EB(el('azarah.gate.mayim'))),
      // keep the set-out courses off the flights' cheeks and the projecting buildings
      ...['azarah.gate.delek.flight', 'azarah.gate.bechorot.flight', 'azarah.gate.mayim.flight', 'azarah.gate.nitzotz.flight', 'azarah.gate.korban.flight',
        'azarah.chamber.etz.flight'].map((id) => EB(el(id))),
      { ...EB(el('azarah.moked.hall')), min: [el('azarah.moked.hall').box.min[0] - 0.5, 395, -1] },
      { ...EB(el('azarah.chamber.gazit')), min: [40, el('azarah.chamber.gazit').box.min[1], -1] },
    ]), (f) => (f.axis === 2 ? 'ashlar_plain' : WALL));
    kit.solid(fr, false, false);
  }

  kit.solid(gridSolid(adds, subs, classify), true, true);
  C.walls = walls;

  // -------------------------------------------------------------------------------------- cornices
  // crowning cornices, door-cases and window surrounds on every tier: a few thousand triangles in the existing
  // marble draw call, and the walls read as architecture rather than boxes
  buildCornices(C, walls);
  buildGateFrames(C);
  buildWindowFrames(C, windows);
}

/** The cavetto crowning profile [[u, v]] (amot), Second-Temple Jerusalem type (cf. the cavetto cornices of the
 *  Kidron-valley monuments) — reconstruction, restrained; no battlements (Part VII §25). */
export const CORNICE = (() => {
  const p = [[0, -1.2], [0.1, -1.2], [0.1, -0.82], [0.16, -0.82]];
  const n = 6;
  for (let i = 1; i <= n; i++) {           // concave cove from (0.16, −0.82) up/out to (0.56, −0.42)
    const t = (Math.PI / 2) * (i / n);
    p.push([0.56 - 0.4 * Math.cos(t), -0.82 + 0.4 * Math.sin(t)]);
  }
  p.push([0.56, -0.18], [0.6, -0.18], [0.6, 0], [0, 0]);
  return p;
})();
const scaleProf = (prof, s) => prof.map(([u, v]) => [u * s, v * s]);

/** cornice around a wall-top rectangle [x0,y0,x1,y1] at height z, every face, corners overlapped. abut: ends ('w'/'e')
 *  that butt against a higher wall's end: no return there, and the long runs stop flush at it (a stop end) */
export function corniceRect(m, x0, y0, x1, y1, z, prof = CORNICE, abut = '') {
  const e = Math.max(...prof.map((p) => p[0]));
  const ew = abut.includes('w') ? 0 : e, ee = abut.includes('e') ? 0 : e;
  sweep(m, prof, [x0 - ew, y0], [x1 + ee, y0], z, [0, -1]);
  sweep(m, prof, [x1 + ee, y1], [x0 - ew, y1], z, [0, 1]);
  if (!abut.includes('w')) sweep(m, prof, [x0, y1 + e], [x0, y0 - e], z, [-1, 0]);
  if (!abut.includes('e')) sweep(m, prof, [x1, y0 - e], [x1, y1 + e], z, [1, 0]);
}

function buildCornices(C, w) {
  const { el, kit } = C;
  const m = kit.m('marble_white', false, true);
  const rect = (x0, y0, x1, y1, z, abut) => corniceRect(m, x0, y0, x1, y1, z, CORNICE, abut);
  const moked = el('azarah.moked.hall').box, gazit = el('azarah.chamber.gazit').box;
  const terrace = el('azarah.wall.south').params.cutouts[0].box;
  // Azarah N wall, split by Beit HaMoked
  rect(w.azN.min[0], w.azN.min[1], moked.min[0], w.azN.max[1], w.azN.max[2]);
  rect(moked.max[0], w.azN.min[1], w.azN.max[0], w.azN.max[1], w.azN.max[2]);
  // S wall, split by the Water Gate roof terrace
  rect(w.azS.min[0], w.azS.min[1], terrace.min[0], w.azS.max[1], w.azS.max[2]);
  rect(terrace.max[0], w.azS.min[1], w.azS.max[0], w.azS.max[1], w.azS.max[2]);
  // W wall, split by the Gazit
  rect(w.azW.min[0], w.azW.min[1], w.azW.max[0], gazit.min[1], w.azW.max[2]);
  rect(w.azW.min[0], gazit.max[1], w.azW.max[0], w.azW.max[1], w.azW.max[2]);
  // the low east walls and the EN walls. The Azarah's N and S walls run through the corner squares to X 260 (site.js),
  // so the EN N/S walls (+46) butt against their 56-amah ends there: their cornices stop flush at X 260 instead of
  // returning round an end that is buried in the higher wall (the return's overhang stuck out of its faces)
  for (const k of ['azE', 'enN', 'enS', 'enE']) {
    const abut = (k === 'enN' || k === 'enS') && Math.abs(w[k].min[0] - w.azN.max[0]) < 1e-6 && w.azN.max[2] > w[k].max[2] ? 'w' : '';
    rect(w[k].min[0], w[k].min[1], w[k].max[0], w[k].max[1], w[k].max[2], abut);
  }
  // EN corner chambers' inner walls (smaller profile)
  const small = scaleProf(CORNICE, 0.7);
  for (const k of ['nazirites', 'wood', 'lepers', 'oil']) {
    const e = el(`en.chamber.${k}`), b = e.box, t = e.params.innerWallT;
    const xIn = b.min[0] === 260 ? [b.max[0] - t, b.max[0]] : [b.min[0], b.min[0] + t];
    const yIn = b.min[1] === 263 ? [b.max[1] - t, b.max[1]] : [b.min[1], b.min[1] + t];
    corniceRect(m, xIn[0], b.min[1], xIn[1], b.max[1], b.max[2], small);
    corniceRect(m, b.min[0], yIn[0], b.max[0], yIn[1], b.max[2], small);
  }
}

/**
 * Marble door-case around a gate opening on one face: two jamb bands and a lintel band (three fasciae), with a
 * small cavetto hood above at detail ≥ 2. face: { axis 'x'|'y', at, out (±1 outward of that face), lo, hi (span along), z0, z1 }.
 */
export function doorCase(C, m, face, band = 1.2, proud = 0.22) {
  const { axis, at, out, lo, hi, z0, z1 } = face;
  const steps = [[0, 0.4, proud * 0.45], [0.4, 0.8, proud * 0.75], [0.8, band, proud]];   // fasciae step out away from the opening
  for (const [b0, b1, p] of steps) {
    const P = (s0, s1, zz0, zz1) => {
      if (axis === 'y') m.box([s0, Math.min(at, at + out * p), zz0], [s1, Math.max(at, at + out * p), zz1], out > 0 ? 'xXYzZ' : 'xXyzZ');
      else m.box([Math.min(at, at + out * p), s0, zz0], [Math.max(at, at + out * p), s1, zz1], out > 0 ? 'XyYzZ' : 'xyYzZ');
    };
    P(lo - b1, lo - b0, z0, z1 + b0);
    P(hi + b0, hi + b1, z0, z1 + b0);
    P(lo - b1, hi + b1, z1 + b0, z1 + b1);
  }
  if (C.d >= 2) {
    const prof = scaleProf(CORNICE, 0.55);
    const z = z1 + band + 0.66;
    const a = axis === 'y' ? [lo - band - 0.3, at] : [at, lo - band - 0.3];
    const b = axis === 'y' ? [hi + band + 0.3, at] : [at, hi + band + 0.3];
    sweep(m, prof, a, b, z, axis === 'y' ? [0, out] : [out, 0]);
  }
}

function buildGateFrames(C) {
  const { el, kit } = C;
  const m = kit.m('marble_white', false, true);
  const gates = [
    ['en.gate.east', 'x'], ['azarah.gate.nikanor', 'x'], ['azarah.gate.delek', 'y'], ['azarah.gate.bechorot', 'y'],
    ['azarah.gate.mayim', 'y'], ['azarah.gate.nitzotz', 'y'], ['azarah.gate.korban', 'y'],
  ];
  for (const [id, axis] of gates) {
    const b = el(id).box;
    const span = axis === 'x' ? [b.min[1], b.max[1]] : [b.min[0], b.max[0]];
    const faces = axis === 'x' ? [[b.min[0], -1], [b.max[0], 1]] : [[b.min[1], -1], [b.max[1], 1]];
    for (const [at, out] of faces) {
      // the Nitzotz gate opens inside its exedra: frame its outer (chel) face only
      if (id === 'azarah.gate.nitzotz' && out < 0) continue;
      doorCase(C, m, { axis, at, out, lo: span[0], hi: span[1], z0: b.min[2], z1: b.max[2] }, id === 'azarah.gate.nikanor' ? 1.35 : 1.2);
    }
  }
}

function buildWindowFrames(C, windows) {
  const m = C.kit.m('marble_white', false, true);
  for (const w of windows) {
    const axis = w.face === 'W' ? 'x' : 'y';
    const faces = axis === 'x' ? [[w.min[0], -1], [w.max[0], 1]] : [[w.min[1], -1], [w.max[1], 1]];
    for (const [at, out] of faces) {
      const lo = axis === 'x' ? w.min[1] : w.min[0], hi = axis === 'x' ? w.max[1] : w.max[0];
      doorCase({ d: 0 }, m, { axis, at, out, lo, hi, z0: w.min[2] - 0.35, z1: w.max[2] }, 0.5, 0.12);
      // sill
      if (axis === 'y') m.box([lo - 0.6, Math.min(at, at + out * 0.3), w.min[2] - 0.35], [hi + 0.6, Math.max(at, at + out * 0.3), w.min[2]]);
      else m.box([Math.min(at, at + out * 0.3), lo - 0.6, w.min[2] - 0.35], [Math.max(at, at + out * 0.3), hi + 0.6, w.min[2]]);
    }
  }
}

/**
 * Floors and substructures as one solid: Ezrat Nashim (+6), the Ezrat Yisrael block with the music cellars,
 * the 1-amah step and duchan (Middot 2:6, lock #10), the Azarah pavement (+16), the Gazit and Moked podiums.
 */
export function buildFloors(C) {
  const { el, kit } = C;
  const adds = [], subs = [];
  const en = el('en.floor').box, ey = el('azarah.ezrat-yisrael').box, az = el('azarah.floor').box;
  const Z_AZ = C.datums.azarah, Z_EY = C.datums.ezratYisrael;
  // the courts are raised platforms: solid fill from the Mount up to each floor (pits and cellars are carved out)
  adds.push(B(en.min[0], en.min[1], 0, en.max[0], en.max[1], en.max[2], { top: 'paving_mount', side: 'ashlar_plain' }));
  // the EY block from the Mount up to +13½ (the music cellars are carved out of it)
  adds.push(B(ey.min[0], ey.min[1], 0, ey.max[0], ey.max[1], Z_EY, { top: 'paving_azarah', side: 'ashlar_plain' }));
  // the 1-amah step and the duchan's three half-steps (Middot 2:6; Rambam BhB 6:3) — down to the Mount so they close the cellars
  const prof = el('azarah.duchan').params.profile;
  for (let i = 0; i < 3; i++) {
    const s = prof[i];
    adds.push(B(s.x - s.tread, ey.min[1], 0, s.x, ey.max[1], s.topZ, { top: 'steps_stone', side: 'steps_stone' }));
  }
  adds.push(B(az.min[0], az.min[1], 0, az.max[0], az.max[1], az.max[2], { top: 'paving_azarah', side: 'ashlar_plain' }));
  // Gazit chol-half substructure (podium), carried through the replaced W-wall line to the court floor
  const gp = el('azarah.chamber.gazit.podium').box;
  adds.push(B(gp.min[0], gp.min[1], 0, az.min[0], gp.max[1], Z_AZ, { top: 'paving_azarah', side: WALL }));
  // Beit HaMoked: the hall floor (marble — the kohanim walked it barefoot, Yoma 1:7 ⚙) and its podium through the wall line
  const mk = el('azarah.moked.hall').box, mp = el('azarah.moked.podium').box;
  adds.push(B(mk.min[0], C.walls.azN.min[1], 0, mk.max[0], mp.max[1], Z_AZ - 1, { top: 'marble_white', side: WALL }));
  adds.push(B(mk.min[0], mk.min[1], Z_AZ - 1, mk.max[0], mk.max[1], Z_AZ, { top: 'marble_white', side: WALL, under: 'ashlar_plain' }));
  // cellars of the instruments (Middot 2:6)
  for (const r of el('en.music-chambers').params.rooms) subs.push({ ...r.box, room: 'ashlar_plain', floor: 'paving_mount', ceil: 'ashlar_plain' });
  // the winding stair shaft from the Moked's NW chamber (Middot 1:6, 1:9), open to the hall floor: its marble landing
  // step is carried out to the shaft walls and meets the chamber's door on the south wall (moked.js)
  const st = el('azarah.underground.stair').box;
  subs.push(B(st.min[0], st.min[1], -2, st.max[0], st.max[1], Z_AZ + 0.01, { room: 'ashlar_plain' }));
  // the keys slab's seat (Middot 1:9)
  const ks = el('azarah.moked.keys-slab').box;
  subs.push(B(ks.min[0], ks.min[1], ks.min[2], ks.max[0], ks.max[1], Z_AZ + 0.01, { mat: 'ashlar_plain' }));
  // pits carved by their owners: the Golah cistern (Middot 5:4), the lepers' mikveh in Ezrat Nashim
  subs.push(...C.floorHoles);
  // the amah: the open water channel in the Azarah pavement (Middot 3:2; Tamid 5:5; Pesachim 5:8) — its open
  // segments from site.js, cut here; the running water surface in it is build-altar's (altar/water.js)
  const amah = el('azarah.amah-channel').params;
  for (const seg of amah.openSegments) subs.push({ ...seg, max: [seg.max[0], seg.max[1], seg.max[2] + 0.01], room: 'ashlar_plain', floor: 'ashlar_plain' });
  // the shafts site.js lists in the court fill (azarah.floor params.shafts): the kiyor's well (Yoma 37a–b), a plastered
  // shaft open at the pavement (build-altar sets its curb, platform and laver in the mouth). The muchni SINKS the laver
  // into the well's water overnight (Abaye: "a wheel that sank it", Yoma 37a; "a kiyor he did not sink", Zevachim 20a),
  // so the water stands above the sunk laver's rim (≈ +14.1 as build-altar lowers it): its surface 1½ amot under the
  // pavement ⚙ level
  for (const sh of el('azarah.floor').params.shafts || []) {
    const w = sh.box;
    subs.push(B(w.min[0], w.min[1], w.min[2], w.max[0], w.max[1], w.max[2] + 0.01, { room: 'plaster', floor: 'plaster' }));
    const wz = Math.max(w.min[2] + 0.5, w.max[2] - 1.5);
    kit.m('water', false, false).box([w.min[0], w.min[1], wz], [w.max[0], w.max[1], wz], 'Z');
  }
  kit.solid(gridSolid(adds, subs, classify), true, true);
}

// Plan of the land outside Har HaBayit: the few streets, the city districts, the keep-out areas and the viewpoints
// kept clear of trees. Shared by the height field (streets and plazas are graded into it) and the city/trees builders.
// All of it is RECONSTRUCTION (docs/decisions/build-mount.md): the sources name the upper city, the Ophel, the
// Kidron gardens (Yoma 58b) and Har HaMishchah, never a street plan. Coordinates: site amot.
import { AMAH } from '../../core/units.js';
import { interp } from '../mount/kit.js';

const memo = new WeakMap();

/** paving top above its graded bed (m) — terrain/context.js drapes the street paving at bed + LIFT */
export const LIFT = 0.17;

export function landPlan(ctx) {
  if (memo.has(ctx)) return memo.get(ctx);
  const A = AMAH;
  const m = (meters) => meters / A;                 // meters -> amot
  const wW = ctx.el('mount.wall.west').box, wE = ctx.el('mount.wall.east').box;
  const wS = ctx.el('mount.wall.south').box, wN = ctx.el('mount.wall.north').box;
  const fp = { x0: wW.min[0], x1: wE.max[0], y0: wS.min[1], y1: wN.max[1] };
  const axisY = ctx.site.axisY;
  const kip = ctx.el('mount.gate.kiponus').box;
  const kipY = (kip.min[1] + kip.max[1]) / 2;
  const cw = ctx.el('context.parah-causeway').box;
  const pyre = ctx.el('context.parah.pyre');
  const chW = ctx.el('mount.gate.chuldah-w').box, chE = ctx.el('mount.gate.chuldah-e').box;
  const tadi = ctx.el('mount.gate.tadi').box;
  const TOPO = ctx.el('context.terrain').params.profilesMeters;

  // west end of the Kiponus bridge: where the Tyropoeon's west slope regains the platform level (740 m)
  let kipEndM = 0;
  for (let w = 60; w < 600; w += 0.5) if (interp(TOPO.W, w) >= ctx.el('context.terrain').params.datumASL) { kipEndM = w; break; }
  const kipEndX = fp.x0 - m(kipEndM);

  const plaza = { x0: chW.min[0] - 45, x1: chE.max[0] + 45, y0: fp.y0 - m(30), y1: fp.y0 };   // Ophel plaza before the Chuldah portals
  const W = (mm) => fp.x0 - m(mm), S = (mm) => fp.y0 - m(mm), N = (mm) => fp.y1 + m(mm);
  const ophX = (plaza.x0 + plaza.x1) / 2;
  // streets bend gently away from the Mount (no ruler-straight cuts through the hills)
  const streets = [
    // the Tyropoeon street along the valley floor west of the Mount
    { id: 'tyropoeon', pts: [[W(46), S(560)], [W(52), S(430)], [W(66), S(300)], [W(62), S(150)], [W(60), kipY], [W(61), N(120)], [W(70), N(230)], [W(88), N(330)]], half: m(3.2) },
    // from the Kiponus bridge into the upper city
    { id: 'kiponus-west', pts: [[kipEndX - 2, kipY], [W(330), kipY + m(6)], [W(480), kipY + m(22)], [W(700), kipY + m(30)]], half: m(3.5) },
    // the Ophel street climbing from the lower city to the Chuldah plaza
    { id: 'ophel', pts: [[ophX, plaza.y0 - m(2)], [ophX + m(10), S(260)], [ophX - m(5), S(420)], [ophX - m(28), S(600)]], half: m(3.5) },
    // a cross street of the lower city, from the Tyropoeon street to the Ophel street
    { id: 'lower-cross', pts: [[W(62), S(150)], [ophX + m(5), S(150)]], half: m(2.6) },
    // up the slope of the upper city
    { id: 'upper-cross', pts: [[W(62), S(150)], [W(300), S(158)], [W(460), S(178)], [W(650), S(200)]], half: m(2.6) },
  ];
  // the path from the end of the causeway up Har HaMishchah to the burning place (Middot 1:3; Parah 3:6–7)
  const parahPath = { id: 'parah-path', pts: [[cw.max[0] + 2, axisY], [pyre.box.min[0] - 10, axisY]], half: 4 };
  // the burning place (terrain/context.js): a stone floor round the arrangement's place, its top the crest ground of
  // site.js, and the beit tevilah's tank against its east edge (Parah 3:7) ⚙. The ground is cut out under both and
  // graded to their edges (grid lines on every edge, so on every tier — terrain/index.js)
  const pb = pyre.box;
  const floor = [pb.min[0] - 2.5, pb.min[1] - 3, pb.max[0] + 2.5, pb.max[1] + 3];
  const tankWall = 0.75, tankIn = [floor[2] + tankWall, axisY + 5, floor[2] + tankWall + 4, axisY + 9];
  const tank = [tankIn[0] - tankWall, tankIn[1] - tankWall, tankIn[2] + tankWall, tankIn[3] + tankWall];
  const burning = { floor, top: pb.min[2], tankIn, tank, tankWall, cut: [floor, tank] };

  // graded level areas: { rect [x0,y0,x1,y1] amot, z (amot, the walking surface), margin (m), drop (m) = how far the
  // graded ground lies under z: 0.32 under the plazas paved here, LIFT where a street's paving is draped on it (its top
  // then meets the bridge deck) and at the causeway's end (the path's ground a kerb's step below the deck, clear of it
  // where the landing runs under the deck's end), 0 where the ground itself is the surface (the Tadi apron)
  const flats = [
    { id: 'ophel-plaza', rect: [plaza.x0, plaza.y0, plaza.x1, plaza.y1], z: chW.min[2], margin: 26, drop: 0.32 },
    { id: 'kiponus-landing', rect: [kipEndX - m(18), kipY - 9, kipEndX + 4, kipY + 9], z: 0, margin: 14, drop: LIFT },
    { id: 'causeway-landing', rect: [cw.max[0] - 4, axisY - 9, cw.max[0] + m(16), axisY + 9], z: 0, margin: 14, drop: LIFT },
    // the stone floor stands LIFT proud of this ground, a low kerb; the Parah path (the graded ground itself since
    // qa-r1-fix-world) runs up to it
    // qa-r1-fix-world: margin 22 → 10 m — the graded level round the floor read as a flat plain from the viewpoint
    { id: 'burning-place', rect: [pyre.box.min[0] - 14, axisY - 16, pyre.box.max[0] + 16, axisY + 16], z: pyre.box.min[2], margin: 10, drop: LIFT },
    { id: 'tadi-apron', rect: [tadi.min[0] - 4, fp.y1, tadi.max[0] + 4, fp.y1 + 10], z: ctx.el('mount.wall.north').params.outerFootZ, margin: 6, drop: 0 },
  ];

  // city districts (rects in amot) and keep-out zones for houses and trees
  const districts = [
    // the upper city across the Tyropoeon (west)
    { id: 'upper', rect: [W(720), S(420), W(75), N(80)], density: 0.85, block: [m(42), m(34)], rot: 0.05 },
    // the north-west quarter
    { id: 'north-west', rect: [W(560), N(80), W(75), N(420)], density: 0.6, block: [m(40), m(32)], rot: -0.04 },
    // the Ophel and the lower city (south)
    { id: 'ophel', rect: [W(40), S(600), fp.x1 + m(35), S(55)], density: 0.8, block: [m(36), m(30)], rot: 0.02 },
    // north of the Mount (sparser)
    { id: 'north', rect: [fp.x0 + m(10), N(70), fp.x1 - m(30), N(420)], density: 0.42, block: [m(46), m(38)], rot: 0.0 },
  ];
  // viewpoints (anchors in mount/posts.js) whose view cone is kept under the sight line (sightTop): [X, Y], heading. The
  // ground viewpoint is site.js groundEye (a viewer on the crest, no pyre built); kohenEye stands on the pyre (Parah 3:9)
  const eye = pyre.params.groundEye;
  const slopeLookout = [eye[0] - 260, axisY - 40];
  const viewpoints = [
    { p: slopeLookout, heading: 280 },
    { p: [eye[0], eye[1]], heading: 270 },
    { p: [ctx.el('context.kidron').params.thalwegX, axisY - 60], heading: 300 },
  ];
  const keepOut = [
    [slopeLookout[0] - m(12), slopeLookout[1] - m(12), slopeLookout[0] + m(12), slopeLookout[1] + m(12)],
    [pyre.box.min[0] - m(12), axisY - m(12), pyre.box.max[0] + m(14), axisY + m(12)],
    [fp.x0 - m(30), fp.y0 - m(30), fp.x1 + m(30), fp.y1 + m(30)],                         // a clear belt round the Mount
    [plaza.x0 - m(10), plaza.y0 - m(10), plaza.x1 + m(10), plaza.y1],                       // the Ophel plaza
    [kipEndX - m(25), kipY - m(14), fp.x0, kipY + m(14)],                                   // the Kiponus bridge
    [fp.x1, axisY - m(16), cw.max[0] + m(30), axisY + m(16)],                               // the Parah causeway
  ];
  // terraced slopes (dry-stone walls along the contours, olives on the benches) and the Kidron garden plots ⚙
  const terraces = { u0: 215, u1: 790, uw0: 70, uw1: 175, yPad: 420 };   // m east of the E wall face; Y padding (m)
  // qa-r1-fix-world: the near field of the Har HaMishchah viewpoints (the crest, the slope lookout, the Parah path between
  // them). The tensor grid gets extra lines across this rectangle (terrain/index.js) so the ground there can carry its
  // micro-relief (terrain/height.js `micro`): x from 125 m west of the slope lookout to just east of the burning place,
  // y over the path and the lookout. `fine`: spacing (m) per tier where the eye stands; `coarse` on the lower slope.
  const detail = {
    x0: slopeLookout[0] - m(125), xFine: slopeLookout[0] - m(30), x1: floor[2] + m(22),
    y0: axisY - m(55), y1: axisY + m(30),
    fine: [6, 4, 3, 2.5], coarse: [9, 6, 5, 4],
  };
  /** 0..1: how far (X, Y) lies inside the detail rectangle (1 inside a 12 m margin) */
  const inDetail = (X, Y) => {
    const e = m(12);
    const f = (v, a, b) => Math.max(0, Math.min(1, (v - a) / e, (b - v) / e));
    return f(X, detail.x0, detail.x1) * f(Y, detail.y0, detail.y1);
  };
  /**
   * The highest top (site Z) a thing may have at (X, Y) without crossing any viewpoint's sight line to the Heichal's
   * entrance (its sill, +22), less half an amah — Infinity outside every view cone. Low things (terrace walls, rocks,
   * ground cover) may stand in the cones as long as they stay under the line; tall ones are held out where they would
   * cross it. `groundZ(X, Y)` gives a viewpoint's ground (site Z).
   */
  const ulamSill = ctx.el('heichal.ulam.opening').box;
  const target = [ulamSill.max[0], axisY, ulamSill.min[2]];
  const sightTop = (X, Y, groundZ) => {
    let top = Infinity;
    for (const v of viewpoints) {
      const dx = (X - v.p[0]) * A, dy = (Y - v.p[1]) * A, d = Math.hypot(dx, dy);
      if (d > 60) continue;
      const h = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      let dh = Math.abs(h - v.heading) % 360; if (dh > 180) dh = 360 - dh;
      if (d >= 12 && dh >= 40) continue;
      v.z ??= groundZ(v.p[0], v.p[1]) + 1.6 / A;
      const D = Math.hypot((target[0] - v.p[0]) * A, (target[1] - v.p[1]) * A) || 1;
      top = Math.min(top, v.z + (target[2] - v.z) * Math.min(1, d / D) - 0.5);
    }
    return top;
  };
  const plan = { fp, axisY, kipY, kipEndX, kipEndM, plaza, streets, parahPath, burning, flats, districts, keepOut, slopeLookout, viewpoints, sightTop, terraces, detail, inDetail, m };
  memo.set(ctx, plan);
  return plan;
}

/** distance (amot) from point to a polyline, and the parameter of the nearest point */
export function distToPolyline(pts, X, Y) {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [cx, cy] = pts[i + 1];
    const dx = cx - ax, dy = cy - ay;
    const L2 = dx * dx + dy * dy || 1;
    let t = ((X - ax) * dx + (Y - ay) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.hypot(X - px, Y - py);
    if (d < best) { best = d; bx = px; by = py; }
  }
  return { d: best, x: bx, y: by };
}

export function inRect(r, X, Y, pad = 0) { return X >= r[0] - pad && X <= r[2] + pad && Y >= r[1] - pad && Y <= r[3] + pad; }
export function rectDist(r, X, Y) {
  const dx = Math.max(r[0] - X, 0, X - r[2]), dy = Math.max(r[1] - Y, 0, Y - r[3]);
  return Math.hypot(dx, dy);
}

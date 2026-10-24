// The Heichal's masonry as ONE greedy-meshed solid: the otem (T-plan podium), the Ulam block (front wall, end
// walls, the Heichal's east wall carrying the great gate), the body (ta'im mass + the aliyah block over the Kodesh
// and KhK, with the ceiling and roof stacks), the parapets — minus every room, void and opening site.js lists.
// Faces are dressed by what they look into (see mat() below). Separate solids: the mesibah stair, the ta'im roof
// stair with its landing and piers. Swept: the exterior kiyur stringcourses. Built: the F1 window splays, the
// kalya orev blade.
//
// Every number is read from src/data/site.js (ctx.el); the few design numbers (course projection, parapet and
// moulding sizes, cell doors) are reconstruction, logged in docs/decisions/build-heichal.md.
import { B, EB, Mesher, gridSolid, sweep } from './lib/geo.js';

export function buildShell(H) {
  const { kit, el, d, axisY: AY } = H;
  const zF = H.zF;                                   // Heichal floor +22
  const otem = el('heichal.otem');
  const front = el('heichal.ulam.wall-front').box;
  const eastW = el('heichal.wall.east').box;
  const ulam = H.rooms.ulam, kod = H.rooms.kodesh, trk = H.rooms.traksin, khk = H.rooms.khk, ali = H.rooms.aliyah;
  const taRoofZ = el('heichal.taim.roofs').params.z;   // +55
  const roofZ = el('heichal.roof').params.z;           // +112
  const maakeh = el('heichal.maakeh');
  const crownZ = el('heichal.kalya-orev').box.max[2];  // +116
  const parTop = maakeh.box.max[2];                    // +115
  const path = maakeh.params.path;
  const xBodyW = el('heichal.ta-wall.west').box.min[0];        // 79
  const yBodyS = el('heichal.outer-wall.south').box.min[1];    // 295.5
  const yBodyN = el('heichal.mesibah-wall').box.max[1];        // 365.5
  const xKodE = kod.max[0];                                    // 157
  const xs = path.map((p) => p[0]), ys = path.map((p) => p[1]);
  // the aliyah block (T stem above the ta'im roofs) from the roof outline: x 91..157, y 315.5..345.5
  const aliBlock = { x0: Math.min(...xs), x1: xKodE, y0: Math.min(...ys.filter((y) => y > front.min[1] + 1)), y1: Math.max(...ys.filter((y) => y < front.max[1] - 1)) };

  // ------------------------------------------------------------------ adds
  const adds = [];
  for (const p of otem.params.pieces) adds.push(EB(p, { t: 'otem' }));
  const UL = B(eastW.min[0], front.min[1], zF, front.max[0], front.max[1], roofZ, { t: 'ulam' });
  adds.push(UL);
  adds.push(B(xBodyW, yBodyS, zF, xKodE, yBodyN, taRoofZ, { t: 'body' }));
  adds.push(B(aliBlock.x0, aliBlock.y0, taRoofZ, aliBlock.x1, aliBlock.y1, roofZ, { t: 'body' }));
  // the five milah lintels and the stone course between each pair (Middot 3:7): stone course k as long as beam k+1.
  // Each beam stands H.lintelProud proud of the facade and each stone course is set back as much, so every lintel
  // casts a shadow line and shows its ends ⚙
  const lint = el('heichal.ulam.lintels');
  const lb = lint.box;
  const LP = H.lintelProud;
  lint.params.beams.forEach((bm, k) => adds.push(B(lb.min[0], AY - bm.length / 2, bm.z[0], lb.max[0] + LP, AY + bm.length / 2, bm.z[1], { t: 'beam', k })));
  lint.params.stoneCourses.forEach((sc, k) => {
    const L = lint.params.beams[k + 1].length;
    adds.push(B(lb.min[0], AY - L / 2, sc.z[0], lb.max[0], AY + L / 2, sc.z[1], { t: 'lstone', k, z0: sc.z[0] }));
  });
  // ma'akeh (3 amot, 1 thick inside the roof outline — Middot 4:6; params.thickness)
  const parT = maakeh.params.thickness;
  for (const s of outlineStrips(path, parT)) {
    const onUlam = s.min[0] >= UL.min[0] - 1e-6;
    adds.push(B(s.min[0], s.min[1], roofZ, s.max[0], s.max[1], parTop, { t: 'parapet', ulam: onUlam, outer: s.outer }));
  }
  // ta'im-roof parapets (site: 3 amot ⚙ along the outer edges and the void edges), 0.5 thick
  const tr = el('heichal.taim.roofs').params;
  const tpH = tr.parapet.height, tpT = 0.5, z0p = taRoofZ, z1p = taRoofZ + tpH;
  const mesVoid = tr.openVoids.mesibah, watVoid = tr.openVoids['beit-horadat-hamayim'];
  const tpar = (x0, y0, x1, y1) => adds.push(B(x0, y0, z0p, x1, y1, z1p, { t: 'tparapet' }));
  tpar(xBodyW, yBodyN - tpT, xKodE, yBodyN);                 // north edge
  tpar(xBodyW, yBodyS, xKodE, yBodyS + tpT);                 // south edge
  tpar(xBodyW, yBodyS, xBodyW + tpT, yBodyN);                // west edge
  tpar(mesVoid.min[0], mesVoid.min[1] - tpT, xKodE, mesVoid.min[1]);   // along the mesibah void
  tpar(mesVoid.min[0], mesVoid.max[1], xKodE, mesVoid.max[1] + tpT);
  tpar(watVoid.min[0], watVoid.max[1], xKodE, watVoid.max[1] + tpT);   // along the water-descent house
  tpar(watVoid.min[0], watVoid.min[1] - tpT, xKodE, watVoid.min[1]);
  tpar(watVoid.min[0] - tpT, watVoid.min[1], watVoid.min[0], watVoid.max[1]);

  // ------------------------------------------------------------------ subs (first listed wins for face tags)
  const subs = [];
  const room = (box, name, extra) => subs.push(EB(box, { t: 'room', room: name, ...(extra || {}) }));
  const open = (box, o, extra) => subs.push(EB(box, { t: 'open', o, ...(extra || {}) }));
  open(el('heichal.ulam.opening').box, 'ulam');
  open(el('heichal.gate.great').box, 'gate');
  open(el('heichal.gate.wicket-n').box, 'wicket');
  open(el('heichal.gate.wicket-s').box, 'wicket');
  open(el('heichal.chalifot.n.wicket').box, 'wicket');
  open(el('heichal.chalifot.s.wicket').box, 'wicket');
  for (const w of el('heichal.windows.f2').params.windows) open(w, 'f2');
  open(el('heichal.ta.door-ne').box, 'door');
  open(el('heichal.ta-wall.north').params.door, 'door');
  open(el('heichal.lul-west').box, 'lul');
  open(el('heichal.aliyah.door').box, 'door');
  open(el('heichal.sotah-slab').box, 'sotah');         // the marble tablet is set into the floor (kodesh.js)
  const lul = el('heichal.aliyah').params.lulin[0];
  open(B(lul.min[0], lul.min[1], kod.max[2], lul.max[0], lul.max[1], lul.max[2]), 'lulin');
  // F1 windows: the outer (wide) opening through the wall; the splays are added back as wedges (buildF1)
  const f1 = H.f1;
  for (const w of f1.windows) open(B(w.x - f1.wOut / 2, w.y0, f1.z0, w.x + f1.wOut / 2, w.y1, f1.z1), 'f1');
  // knife niches of the beit hachalifot (24: 12 + 12 — SG; Sukkah 56b), Bilgah's sealed (south wing)
  for (const n of H.niches) open(n.box, n.sealed ? 'sealed' : 'niche');
  room(ulam, 'ulam');
  room(kod, 'kodesh');
  room(trk, 'traksin');
  room(khk, 'khk');
  room(ali, 'aliyah');
  // the mesibah (open to the sky above the stair; the landing slab covers its NW head) and the water-descent house
  const mes = el('heichal.mesibah').box;
  room(B(mes.min[0], mes.min[1], zF, mes.max[0], mes.max[1], taRoofZ - 1), 'mesibah');
  room(mesVoid, 'mesibah');
  room(el('heichal.beit-horadat-hamayim').box, 'water');
  // the ta'im: 38 cells (lock #38: solid walls, cells in file); low detail carves only the NE lower cell (the daily route)
  for (const c of H.cells) room(c.box, 'cell', { cell: c });
  for (const o of H.cellOpenings) open(o.box, o.o);
  // the Ulam's rovadin: plain 1-amah courses set back between 3-amah rovadin, whose heads read as ledges (Rambam BhB 4:9)
  for (const r of rovadinRecesses(H, UL, lint, aliBlock, taRoofZ)) subs.push(r);
  // the stone courses between the lintels, set back
  lint.params.stoneCourses.forEach((sc, k) => {
    const L = lint.params.beams[k + 1].length;
    subs.push(B(lb.max[0] - LP, AY - L / 2, sc.z[0], lb.max[0] + 1, AY + L / 2, sc.z[1], { t: 'lrecess', k, z0: sc.z[0] }));
  });

  // ------------------------------------------------------------------ face dressing
  // F1: the plated throat (one amah in from the Kodesh face) ends on these planes
  const f1Cuts = [kod.max[1] + 1, kod.min[1] - 1];
  const cuts = [[], [H.gateSurround.y0, H.gateSurround.y1, ...f1Cuts], [H.reliefZ0, H.reliefZ1, el('heichal.gate.great').box.max[2], H.gateSurround.z1]];
  const bandKey = (type, k) => `herodian_wall_inner_courses|ub:${type}:${k}`;
  // the white courses between the lintels: the herodian set's white row with its joints, true scale
  const lstoneKey = (z0) => `herodian_wall_inner_courses|uz:${z0}`;
  const f1Throat = (Y) => Math.abs(Y - kod.max[1]) < 1 + 1e-6 || Math.abs(Y - kod.min[1]) < 1 + 1e-6;
  const bandAt = (Z) => {
    const r = Z - H.bandBase;
    const k = Math.min(Math.floor(r / 4), H.bandTopK);
    return bandKey(r - 4 * k < 1 ? 'c' : 'r', k);
  };
  const vertical = (f) => f.axis !== 2;
  const up = (f) => f.axis === 2 && f.dir > 0;
  const down = (f) => f.axis === 2 && f.dir < 0;
  const mat = (f) => {
    const s = f.sub, a = f.add, [X, Y, Z] = f.center;
    if (s && s.t === 'room') {
      switch (s.room) {
        case 'kodesh': case 'khk': {
          if (up(f)) return 'gold_plate';
          if (down(f)) return d >= 1 ? null : 'gold_plate';            // coffered kiyur ceiling built separately
          if (s.room === 'kodesh' && f.axis === 0 && f.dir < 0 && Math.abs(X - kod.max[0]) < 1e-3
            && Z < H.doorTopZ && Math.abs(Y - AY) > H.gateHalfW) return 'herodian_wall_inner_courses';   // behind the doors (Middot 4:1)
          if (Z < H.reliefZ0 || Z > H.reliefZ1) return 'gold_plate';
          return 'gold_relief|relief';
        }
        case 'traksin': return down(f) ? (d >= 1 ? null : 'gold_plate') : 'gold_plate';
        case 'ulam':
          if (up(f)) return 'paving_azarah';
          if (down(f)) return 'marble_white';
          if (f.axis === 0 && f.dir > 0 && Y > H.gateSurround.y0 && Y < H.gateSurround.y1 && Z < H.gateSurround.z1) return 'marble_white';
          return 'herodian_wall_inner_courses';
        case 'aliyah': return up(f) ? 'marble_white' : down(f) ? 'plaster' : 'ashlar_plain';
        case 'mesibah': return up(f) ? 'steps_stone' : 'ashlar_plain';
        case 'water': return up(f) ? 'paving_azarah' : 'ashlar_plain';
        default: return up(f) ? 'paving_azarah' : 'ashlar_plain';   // cells
      }
    }
    if (s && s.t === 'open') {
      if (a.t === 'beam') return 'oak_milah|grainY';
      if (a.t === 'lstone') return lstoneKey(a.z0);
      switch (s.o) {
        case 'sotah': return null;
        // plated within (Middot 4:1, "the whole house" inside); the outer splay is the wall's own washed stone
        case 'f1': return f1Throat(Y) ? 'gold_plate' : 'heichal_whitewash';
        // the niches and the sealed plug: the wing's own dressed stone (Bilgah's plug, veined marble)
        case 'niche': return 'ashlar_plain';
        case 'sealed': return 'marble_veined';
        case 'door': case 'lulin': return 'ashlar_plain';
        case 'lul': return 'ashlar_plain';
        default: return 'marble_white';
      }
    }
    if (s && s.t === 'recess') {
      if (a.t === 'beam') return 'oak_milah|grainY';
      if (f.axis === s.faceAxis && f.dir === s.faceDir) return bandKey('c', s.k);
      return 'herodian_wall_inner_courses';
    }
    if (s && s.t === 'lrecess') {
      if (a.t === 'beam') return 'oak_milah|grainY';
      if (a.t === 'lstone') return lstoneKey(a.z0);
      return vertical(f) ? bandAt(Z) : 'herodian_wall_inner_courses';
    }
    // exterior faces
    switch (a.t) {
      case 'otem': return up(f) ? 'paving_azarah' : 'herodian_wall_courses';
      case 'beam': return 'oak_milah|grainY';
      case 'lstone': return lstoneKey(a.z0);
      case 'ulam': return up(f) ? 'roof_plaster' : vertical(f) ? bandAt(Z) : 'herodian_wall_inner_courses';
      case 'parapet': {
        if (up(f)) return 'marble_white';
        const isOuter = f.axis === a.outer.axis && f.dir === a.outer.dir;
        if (a.ulam && isOuter) return bandAt(Z);
        return isOuter ? 'heichal_whitewash' : 'marble_white';
      }
      case 'tparapet': return up(f) ? 'marble_white' : 'heichal_whitewash';
      default: return up(f) ? 'roof_plaster' : 'heichal_whitewash';    // body
    }
  };
  const t0 = performance.now();
  kit.solid(gridSolid(adds, subs, mat, cuts), true, true);
  H.stats.solidMs = Math.round(performance.now() - t0);

  buildF1(H);
  buildMesibahStair(H, mes, taRoofZ);
  buildRoofStair(H);
  buildKalyaOrev(H, path, parT, parTop, crownZ);
  buildStringcourses(H, aliBlock, xKodE, UL, lint);
  buildCoping(H, path, parTop);
  H.aliBlock = aliBlock;
}

/** strips of thickness t inside an orthogonal closed outline (one per edge; corners filled at reflex vertices) */
function outlineStrips(path, t) {
  const n = path.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = path[i], q = path[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area > 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = path[i], q = path[(i + 1) % n];
    const dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]);
    const inN = ccw ? [-dy, dx] : [dy, -dx];                   // inward normal
    // extend at a reflex (concave) corner so the parapet turns it
    const prev = path[(i - 1 + n) % n], next = path[(i + 2) % n];
    const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const reflexStart = ccw ? turn(prev, p, q) < 0 : turn(prev, p, q) > 0;
    const reflexEnd = ccw ? turn(p, q, next) < 0 : turn(p, q, next) > 0;
    const e0 = reflexStart ? t : 0, e1 = reflexEnd ? t : 0;
    const a = [p[0] - dx * e0, p[1] - dy * e0], b = [q[0] + dx * e1, q[1] + dy * e1];
    const c = [a[0] + inN[0] * t, a[1] + inN[1] * t], dd = [b[0] + inN[0] * t, b[1] + inN[1] * t];
    const min = [Math.min(a[0], b[0], c[0], dd[0]), Math.min(a[1], b[1], c[1], dd[1])];
    const max = [Math.max(a[0], b[0], c[0], dd[0]), Math.max(a[1], b[1], c[1], dd[1])];
    // the outline face of this strip: normal = −inN
    const outer = Math.abs(inN[0]) > 0 ? { axis: 0, dir: -Math.sign(inN[0]) } : { axis: 1, dir: -Math.sign(inN[1]) };
    out.push({ min, max, outer });
  }
  return out;
}

/** recess boxes for the plain courses of the Ulam's rovadin, on every exposed face of the Ulam block */
function rovadinRecesses(H, UL, lint, aliBlock, taRoofZ) {
  const out = [];
  const T = H.rovadRecess, AY = H.axisY;
  const beams = lint.params.beams;
  for (let k = 0; k <= H.bandTopK; k++) {
    const z0 = H.bandBase + 4 * k, z1 = z0 + 1;
    // east facade: split around the lintel stack where a beam sits at this course height
    const beam = beams.find((b) => b.z[0] < z1 - 1e-6 && b.z[1] > z0 + 1e-6);
    const yExtra = 0.5;
    const spans = beam ? [[UL.min[1] - yExtra, AY - beam.length / 2], [AY + beam.length / 2, UL.max[1] + yExtra]] : [[UL.min[1] - yExtra, UL.max[1] + yExtra]];
    for (const [y0, y1] of spans) out.push(B(UL.max[0] - T, y0, z0, UL.max[0] + 0.5, y1, z1, { t: 'recess', k, faceAxis: 0, faceDir: 1 }));
    // north and south end faces
    out.push(B(UL.min[0] - 0.5, UL.max[1] - T, z0, UL.max[0] + 0.5, UL.max[1] + 0.5, z1, { t: 'recess', k, faceAxis: 1, faceDir: 1 }));
    out.push(B(UL.min[0] - 0.5, UL.min[1] - 0.5, z0, UL.max[0] + 0.5, UL.min[1] + T, z1, { t: 'recess', k, faceAxis: 1, faceDir: -1 }));
    // west faces of the wings (beyond the 70-amah body) and, above the ta'im roofs, beside the aliyah block
    const west = [[UL.min[1] - 0.5, H.yBodyS], [H.yBodyN, UL.max[1] + 0.5]];
    if (z0 >= taRoofZ) west.push([H.yBodyS, aliBlock.y0], [aliBlock.y1, H.yBodyN]);
    for (const [y0, y1] of west) out.push(B(UL.min[0], y0, z0, UL.min[0] + T, y1, z1, { t: 'recess', k, faceAxis: 0, faceDir: -1 }));
  }
  return out;
}

/**
 * F1 windows: splayed reveals — narrow (1) at the Kodesh face, wide (2) outside (Menachot 86b; Part VII §22). The
 * plating (Middot 4:1: the house within) lines only the throat, the first amah in from the Kodesh face; the outer
 * splay is the wall's washed stone, so no gold shows from the ta'im roofs.
 */
function buildF1(H) {
  const { kit, f1 } = H;
  const g = kit.m('gold_plate', true, false);
  const st = kit.m('heichal_whitewash', true, false);
  for (const w of f1.windows) {
    const inner = w.inner, outer = w.outer;     // y of the Kodesh face and of the exterior face
    const s = Math.sign(outer - inner);
    const k = Math.min(1, 1 / Math.abs(outer - inner));
    const ym = inner + (outer - inner) * k;
    for (const side of [-1, 1]) {
      // wedge in plan: (x ± wIn/2, inner) → (x ± wOut/2, outer). Only its sloped face (looking toward the window's
      // centre line) and its strip on the Kodesh face are visible; the box cut's sill and soffit lie behind it.
      const xi = w.x + side * f1.wIn / 2, xo = w.x + side * f1.wOut / 2, xm = xi + (xo - xi) * k;
      g.quadH([xi, inner, f1.z0], [xm, ym, f1.z0], [xm, ym, f1.z1], [xi, inner, f1.z1], [-side, 0, 0]);
      st.quadH([xm, ym, f1.z0], [xo, outer, f1.z0], [xo, outer, f1.z1], [xm, ym, f1.z1], [-side, 0, 0]);
      g.quadH([xo, inner, f1.z0], [xi, inner, f1.z0], [xi, inner, f1.z1], [xo, inner, f1.z1], [0, -s, 0]);
    }
  }
}

/** the mesibah: 66 half-steps from the NE (+22) to the NW onto the ta'im roofs, in six flights with landings ⚙ */
function buildMesibahStair(H, mes, taRoofZ) {
  const { kit, el } = H;
  const p = el('heichal.mesibah').params;
  const risers = p.risers, rise = p.rise, tread = p.tread;     // 66, ½, ½
  const flights = 6, per = risers / flights;                  // 11
  const xTop = el('heichal.taim.roofs').params.openVoids.mesibah.min[0];   // 88: the landing slab's edge
  const xStart = mes.max[0] - H.mesibahFootLanding;            // 147: the level landing at the NE door
  const period = (xStart - xTop - (per - 1) * tread) / (flights - 1);
  const xR = (i) => { const f = Math.floor(i / per), r = i % per; return xStart - f * period - r * tread; };   // riser i (0-based)
  const adds = [];
  for (let i = 0; i < risers - 1; i++) {
    const x1 = xR(i), x0 = xR(i + 1);
    adds.push(B(x0, mes.min[1], mes.min[2], x1, mes.max[1], mes.min[2] + rise * (i + 1)));
  }
  const map = gridSolid(adds, [], (f) => {
    if (f.axis === 1) return null;                              // against the mesibah walls
    if (f.axis === 2 && f.dir < 0) return null;
    return 'steps_stone';
  });
  kit.solid(map, true, true);
  H.stats.mesibah = { flights, per, landing: +(period - (per - 1) * tread).toFixed(2), top: taRoofZ };
}

/** the stair on the south ta'im roof (24 half-steps rising east) with cheek walls, its landing on piers and parapets */
function buildRoofStair(H) {
  const { kit, el } = H;
  const p = el('heichal.taim.roof-stair').params;
  const c = p.climb.box, L = p.landing.box;
  const n = p.climb.steps, rise = p.climb.rise, tread = p.climb.tread;
  const cheek = 0.4, cheekH = 1.5;
  const adds = [];
  for (let i = 0; i < n; i++) {
    const x0 = c.min[0] + i * tread, x1 = i === n - 1 ? c.max[0] : x0 + tread, zt = c.min[2] + rise * (i + 1);
    adds.push(B(x0, c.min[1], c.min[2], x1, c.max[1], zt, { t: 'step' }));
    adds.push(B(x0, c.min[1], zt, x1, c.min[1] + cheek, zt + cheekH, { t: 'cheek' }));
    adds.push(B(x0, c.max[1] - cheek, zt, x1, c.max[1], zt + cheekH, { t: 'cheek' }));
  }
  // landing (open below, on piers), its parapets; the north edge meets the aliyah wall at the door
  adds.push(B(L.min[0], L.min[1], L.min[2], L.max[0], L.max[1], L.max[2], { t: 'landing' }));
  const zp = L.min[2], zt = L.max[2], pier = 1;
  for (const x of [L.min[0], L.max[0] - pier]) adds.push(B(x, L.min[1], c.min[2], x + pier, L.min[1] + pier, zp, { t: 'pier' }));
  adds.push(B(L.min[0], L.min[1], zt, L.max[0], L.min[1] + cheek, zt + cheekH, { t: 'cheek' }));
  adds.push(B(L.max[0] - cheek, L.min[1], zt, L.max[0], L.max[1] - 1, zt + cheekH, { t: 'cheek' }));
  adds.push(B(L.min[0], c.max[1], zt, L.min[0] + cheek, L.max[1] - 1, zt + cheekH, { t: 'cheek' }));
  const map = gridSolid(adds, [], (f) => {
    if (f.axis === 2 && f.dir < 0 && Math.abs(f.at - c.min[2]) < 1e-3) return null;   // on the roof
    if (f.axis === 2 && f.dir > 0) return f.add.t === 'step' || f.add.t === 'landing' ? 'steps_stone' : 'marble_white';
    return 'heichal_whitewash';
  });
  kit.solid(map, true, true);
  // the two cedar posts at the aliyah door by which one climbed to the aliyah's roof (Middot 4:5)
  const door = el('heichal.aliyah.door').params;
  for (const [x, y, z] of door.cedarPosts) H.posts.push({ x, y, z0: z, z1: door.postsTopZ });
}

/** the kalya orev: a continuous iron blade "like a sword", one amah high, on the parapet all round (lock #27) */
function buildKalyaOrev(H, path, parT, z0, z1) {
  const { kit, d } = H;
  const n = path.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = path[i], q = path[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area > 0;
  // centre line of the parapet: the outline moved half the thickness inward (orthogonal outline → exact at corners)
  const inward = (i) => {
    const p = path[i], q = path[(i + 1) % n];
    const dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]);
    return ccw ? [-dy, dx] : [dy, -dx];
  };
  const centre = path.map((p, i) => {
    const a = inward((i - 1 + n) % n), b = inward(i);
    return [p[0] + (a[0] + b[0]) * parT / 2, p[1] + (a[1] + b[1]) * parT / 2];
  });
  // section (half-widths, amot) bottom → top: a heavy base set in the coping, straight flats, a bevelled edge
  const tb = 0.035, tm = 0.022, H1 = (z1 - z0);
  const prof = d >= 1 ? [[tb, 0], [tm, 0.12], [tm, 0.8 * H1], [0.002, H1]] : [[tm, 0], [tm, 0.8 * H1], [0.002, H1]];
  const m = kit.m('iron', true, true);
  for (let i = 0; i < n; i++) {
    const a = centre[i], b = centre[(i + 1) % n];
    const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
    const nn = [-dy, dx];
    // run a little past each corner so the blade reads continuous
    const e = tb;
    const A = [a[0] - dx * e, a[1] - dy * e], Bp = [b[0] + dx * e, b[1] + dy * e];
    for (let j = 0; j + 1 < prof.length; j++) {
      const [w0, h0] = prof[j], [w1, h1] = prof[j + 1];
      for (const sgn of [-1, 1]) {
        const P = (pt, w, h) => [pt[0] + nn[0] * w * sgn, pt[1] + nn[1] * w * sgn, z0 + h];
        m.quadH(P(A, w0, h0), P(Bp, w0, h0), P(Bp, w1, h1), P(A, w1, h1), [nn[0] * sgn, nn[1] * sgn, (w0 - w1) * 2]);
      }
    }
    // end caps are hidden in the corner overlaps
  }
}

/**
 * The kiyur at each ceiling line (Middot 4:6, lock #40; Part VII §25 "a one-amah moulded course at each ceiling line"),
 * outside: round the aliyah block and round the Ulam block (at +62 it takes the place of that plain course and stops
 * against the lintel beams), so the whole house carries two moulded bands — base, two storeys, parapet.
 */
function buildStringcourses(H, ab, xKodE, UL, lint) {
  const { kit, el, d } = H;
  const zs = [el('heichal.ceiling.kiyur').box.min[2], el('heichal.roof.kiyur').box.min[2]];
  // profile (u out, v up), one amah: fascia, cyma reversa, fascia, cavetto-crowned top with a drip
  const prof = d >= 1
    ? [[0, 0], [0.12, 0], [0.12, 0.22], [0.2, 0.34], [0.2, 0.5], [0.24, 0.56], [0.24, 0.68], [0.34, 0.86], [0.36, 0.86], [0.36, 1], [0, 1]]
    : [[0, 0], [0.2, 0], [0.36, 0.86], [0.36, 1], [0, 1]];
  const m = kit.m('marble_white', true, true);
  const e0 = 0.36;
  const AY = H.axisY;
  // the cedar posts at the aliyah door rise past the cornices on the south face: the courses are notched round them
  const posts = H.posts.map((p) => [p.x - 0.4, p.x + 0.4]).sort((a, b) => a[0] - b[0]);
  const along = (x0, x1) => {
    const out = [];
    let a = x0;
    for (const [p0, p1] of posts) { if (p1 <= a || p0 >= x1) continue; if (p0 > a) out.push([a, p0]); a = Math.max(a, p1); }
    if (a < x1) out.push([a, x1]);
    return out;
  };
  for (const z of zs) {
    // qa-r1-fix-world: deeper cornices, so the house reads as built storeys from the Mount and the hills, not a slab —
    // the +62 kiyur 0.6 amah round the aliyah block (¾ round the Ulam block), the crowning +107 kiyur 1 amah all round
    const low = z < zs[1] - 1;
    const sa = low ? H.kiyurLowScale : H.kiyurRoofScale;
    const pa = prof.map(([u, v]) => [u * sa, v]), e = e0 * sa;
    // aliyah block: S (notched for the cedar posts), N and W faces
    for (const [x0, x1] of along(ab.x0 - e, xKodE)) sweep(m, pa, [x0, ab.y0], [x1, ab.y0], z, [0, -1]);
    sweep(m, pa, [xKodE, ab.y1], [ab.x0 - e, ab.y1], z, [0, 1]);
    sweep(m, pa, [ab.x0, ab.y1 + e], [ab.x0, ab.y0 - e], z, [-1, 0]);
    // Ulam block: east face (broken by the lintel beam lying at this height), north and south ends, exposed west faces.
    // At the first ceiling line (+62) it is the storey line of the 100-amah front ⚙
    const sc = low ? H.kiyurUlamScale : H.kiyurRoofScale;
    // at +62 it lies on a plain (set-back) course: its back fills the recess
    const pu = prof.map(([u, v]) => [u === 0 && low ? -H.rovadRecess : u * sc, v]), eu = e0 * sc;
    const beam = lint.params.beams.find((b) => b.z[0] < z + 1 - 1e-6 && b.z[1] > z + 1e-6);
    const east = beam ? [[UL.min[1] - eu, AY - beam.length / 2], [AY + beam.length / 2, UL.max[1] + eu]] : [[UL.min[1] - eu, UL.max[1] + eu]];
    for (const [y0, y1] of east) sweep(m, pu, [UL.max[0], y0], [UL.max[0], y1], z, [1, 0]);
    sweep(m, pu, [UL.min[0] - eu, UL.max[1]], [UL.max[0] + eu, UL.max[1]], z, [0, 1]);
    sweep(m, pu, [UL.max[0] + eu, UL.min[1]], [UL.min[0] - eu, UL.min[1]], z, [0, -1]);
    for (const [y0, y1] of [[UL.min[1] - eu, ab.y0], [ab.y1, UL.max[1] + eu]]) sweep(m, pu, [UL.min[0], y1], [UL.min[0], y0], z, [-1, 0]);
  }
}

/** a restrained cavetto coping crowning the ma'akeh's outer face, under the kalya orev (no battlements — §25) */
function buildCoping(H, path, parTop) {
  const { kit, d } = H;
  // qa-r1-fix-world: projection 0.55 amah (H.copingOut; was 0.34) — the cavetto's shadow is the roof line seen from afar
  const k = H.copingOut / 0.34;
  const prof = (d >= 1 ? [[0, 0], [0.06, 0], [0.06, 0.16], [0.12, 0.3], [0.3, 0.6], [0.34, 0.62], [0.34, 0.8], [0, 0.8]] : [[0, 0], [0.34, 0.6], [0.34, 0.8], [0, 0.8]]).map(([u, v]) => [u * k, v]);
  const m = kit.m('marble_white', true, true);
  const n = path.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = path[i], q = path[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area > 0;
  const z = parTop - 0.8, e = H.copingOut;
  for (let i = 0; i < n; i++) {
    const p = path[i], q = path[(i + 1) % n];
    const dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]);
    const out = ccw ? [dy, -dx] : [-dy, dx];
    const prev = path[(i - 1 + n) % n], next = path[(i + 2) % n];
    const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const convexStart = ccw ? turn(prev, p, q) > 0 : turn(prev, p, q) < 0;
    const convexEnd = ccw ? turn(p, q, next) > 0 : turn(p, q, next) < 0;
    const a = [p[0] - dx * (convexStart ? e : 0), p[1] - dy * (convexStart ? e : 0)];
    const b = [q[0] + dx * (convexEnd ? e : 0), q[1] + dy * (convexEnd ? e : 0)];
    sweep(m, prof, a, b, z, out);
  }
}

export { Mesher };

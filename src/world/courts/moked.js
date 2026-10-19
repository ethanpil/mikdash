// Beit HaMoked (Middot 1:5–9; Tamid 1:1; Rambam BhB 5:9–10, 8:5–6; locks #8, #43; lock §58 24 × 24): a domed hall
// (kippah) straddling the north wall, ringed by stepped stone ledges (rovadin) where the elders slept with the keys;
// four corner chambers "like small bedrooms opening onto a banquet hall"; the marble keys slab with its ring; the
// hearth; the gate with its wicket and the door to the chel. Below: the winding stair, the lamp-lit passage under the
// Birah and the Beit HaTevilah with its mikveh, fire and privy (Tamid 1:1; Middot 1:9).
import { B, gridSolid, lathe, sweep } from './lib/geo.js';
import { shell, flight, spiral, lamp, lampStand, wallLamp, starFire } from './lib/parts.js';
import { classify } from './masonry.js';
import { leafGeometry, meshOf, Object3D } from './lib/kit.js';
import { AMAH, m2w } from '../../core/units.js';
import { TorusGeometry } from 'three';

export function buildMoked(C) {
  hall(C);
  dome(C);
  furnishings(C);
  cornerChambers(C);
  gates(C);
  underground(C);
}

const geom = (C) => {
  const h = C.el('azarah.moked.hall'), p = h.params;
  return { h, p, b: h.box, i: p.interior, Z: p.floorZ, spring: p.dome.springZ, R: p.dome.radius, c: p.dome.center, t: p.wallT };
};

// --------------------------------------------------------------------------------------------- the hall
function hall(C) {
  const { b, i, Z, spring, t } = geom(C);
  const g = C.el('azarah.gate.moked').box, dc = C.el('azarah.moked.door-chel').box;
  const ring = [
    B(b.min[0], b.min[1], Z, b.max[0], i.min[1], spring + 1), B(b.min[0], i.max[1], Z, b.max[0], b.max[1], spring + 1),
    B(b.min[0], i.min[1], Z, i.min[0], i.max[1], spring + 1), B(i.max[0], i.min[1], Z, b.max[0], i.max[1], spring + 1),
  ].map((x) => ({ ...x, top: 'roof_plaster' }));
  const subs = [
    { ...B(g.min[0], g.min[1] - 0.01, g.min[2], g.max[0], g.max[1] + 0.01, g.max[2]), mat: 'marble_white' },
    { ...B(dc.min[0], dc.min[1] - 0.01, dc.min[2], dc.max[0], dc.max[1] + 0.01, dc.max[2]), mat: 'marble_white' },
  ];
  C.kit.solid(gridSolid(ring, subs, (f) => {
    if (f.sub?.mat) return f.sub.mat;
    if (f.axis === 2) return f.dir > 0 ? 'roof_plaster' : 'ashlar_plain';
    const p = [f.center[0] + (f.axis === 0 ? f.dir * 0.01 : 0), f.center[1] + (f.axis === 1 ? f.dir * 0.01 : 0)];
    const inside = p[0] > i.min[0] && p[0] < i.max[0] && p[1] > i.min[1] && p[1] < i.max[1];
    if (inside) return 'ashlar_plain';
    return p[1] < 398 ? 'herodian_wall_inner' : 'herodian_wall';
  }), true, true);
  // the corner slabs carrying the dome over the square (springing at the walls' head) ⚙
  const { c, R } = geom(C);
  const rIn = R - 0.5, m = C.kit.m('ashlar_plain', false, true), top = C.kit.m('roof_plaster', false, true);
  const n = [32, 48, 64, 96][C.d] || 48;
  const sq = (a) => { // point on the interior square along direction a
    const dx = Math.cos(a), dy = Math.sin(a);
    const hx = (i.max[0] - i.min[0]) / 2, hy = (i.max[1] - i.min[1]) / 2;
    const s = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy)));
    return [c[0] + dx * s, c[1] + dy * s];
  };
  const rTop = Math.sqrt(R * R - 1);
  for (let k = 0; k < n; k++) {
    const a0 = (2 * Math.PI * k) / n, a1 = (2 * Math.PI * (k + 1)) / n;
    const q0 = sq(a0), q1 = sq(a1);
    const p0 = [c[0] + Math.cos(a0) * rIn, c[1] + Math.sin(a0) * rIn], p1 = [c[0] + Math.cos(a1) * rIn, c[1] + Math.sin(a1) * rIn];
    m.quadH([p0[0], p0[1], spring], [q0[0], q0[1], spring], [q1[0], q1[1], spring], [p1[0], p1[1], spring], [0, 0, -1]);
    const t0 = [c[0] + Math.cos(a0) * rTop, c[1] + Math.sin(a0) * rTop], t1 = [c[0] + Math.cos(a1) * rTop, c[1] + Math.sin(a1) * rTop];
    top.quadH([t0[0], t0[1], spring + 1], [q0[0], q0[1], spring + 1], [q1[0], q1[1], spring + 1], [t1[0], t1[1], spring + 1], [0, 0, 1]);
  }
  // a moulded band at the springing (detail ≥ 1)
  if (C.d >= 1) {
    const mb = C.kit.m('marble_white', false, false);
    const e = 0.18;
    mb.box([i.min[0], i.min[1], spring - 0.6], [i.max[0], i.min[1] + e, spring], 'Y');
    mb.box([i.min[0], i.max[1] - e, spring - 0.6], [i.max[0], i.max[1], spring], 'y');
    mb.box([i.min[0], i.min[1], spring - 0.6], [i.min[0] + e, i.max[1], spring], 'X');
    mb.box([i.max[0] - e, i.min[1], spring - 0.6], [i.max[0], i.max[1], spring], 'x');
    mb.box([i.min[0], i.min[1] + e, spring - 0.6], [i.max[0], i.min[1] + e, spring], 'z');
  }
  // a cornice round the roof edge
  {
    const prof = [[0, -0.8], [0.1, -0.8], [0.1, -0.5], [0.35, -0.25], [0.4, -0.25], [0.4, 0], [0, 0]];
    const cm = C.kit.m('marble_white', false, true);
    const e = 0.4;
    sweepRect(cm, prof, b.min[0], b.min[1], b.max[0], b.max[1], spring + 1, e);
  }
}

function sweepRect(m, prof, x0, y0, x1, y1, z, e) {
  sweep(m, prof, [x0 - e, y0], [x1 + e, y0], z, [0, -1]);
  sweep(m, prof, [x1 + e, y1], [x0 - e, y1], z, [0, 1]);
  sweep(m, prof, [x0, y1 + e], [x0, y0 - e], z, [-1, 0]);
  sweep(m, prof, [x1, y0 - e], [x1, y1 + e], z, [1, 0]);
}

// ---------------------------------------------------------------------------------------------- the dome
// "Beit HaMoked was a dome (kippah)" (Middot 1:6; Tamid 1:1): a hemisphere over the hall, crown at the site box top;
// an oculus lets the hearth's smoke out ⚙ (no source; a smoke vent is needed for a fire indoors).
function dome(C) {
  const { c, spring, R } = geom(C);
  const rIn = R - 0.5, rOut = R, oc = 1.1;
  const nA = [24, 40, 56, 80][C.d] || 40, nE = [6, 10, 14, 20][C.d] || 10;
  const inner = C.kit.m('plaster', false, true), outer = C.kit.m('roof_plaster', false, true);
  const ring = (r, e) => { const ce = Math.cos(e), se = Math.sin(e); return (a) => [c[0] + r * ce * Math.cos(a), c[1] + r * ce * Math.sin(a), spring + r * se]; };
  const nrm = (e, a, s) => [s * Math.cos(e) * Math.cos(a), s * Math.cos(e) * Math.sin(a), s * Math.sin(e)];
  const eMaxIn = Math.acos(oc / rIn), eMaxOut = Math.acos(oc / rOut), eMinOut = Math.asin(1 / rOut);
  for (const [r, e0, e1, m, s] of [[rIn, 0, eMaxIn, inner, -1], [rOut, eMinOut, eMaxOut, outer, 1]]) {
    for (let j = 0; j < nE; j++) {
      const ea = e0 + ((e1 - e0) * j) / nE, eb = e0 + ((e1 - e0) * (j + 1)) / nE;
      const A = ring(r, ea), Bq = ring(r, eb);
      for (let k = 0; k < nA; k++) {
        const a0 = (2 * Math.PI * k) / nA, a1 = (2 * Math.PI * (k + 1)) / nA;
        const p00 = A(a0), p01 = A(a1), p10 = Bq(a0), p11 = Bq(a1);
        const n00 = nrm(ea, a0, s), n01 = nrm(ea, a1, s), n10 = nrm(eb, a0, s), n11 = nrm(eb, a1, s);
        if (s > 0) { m.triN(p00, p01, p11, n00, n01, n11); m.triN(p00, p11, p10, n00, n11, n10); } else { m.triN(p00, p11, p01, n00, n11, n01); m.triN(p00, p10, p11, n00, n10, n11); }
      }
    }
  }
  // oculus rim
  const rimM = C.kit.m('marble_white', false, true);
  const zi = spring + Math.sqrt(rIn * rIn - oc * oc), zo = spring + Math.sqrt(rOut * rOut - oc * oc);
  for (let k = 0; k < nA; k++) {
    const a0 = (2 * Math.PI * k) / nA, a1 = (2 * Math.PI * (k + 1)) / nA;
    const P = (a, z) => [c[0] + oc * Math.cos(a), c[1] + oc * Math.sin(a), z];
    rimM.quadH(P(a0, zi), P(a1, zi), P(a1, zo), P(a0, zo), [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0]);
  }
  // carved rings inside the dome (Herodian domes carry geometric relief — cf. the Double Gate vestibule) ⚙ (detail ≥ 2)
  if (C.d >= 2) {
    for (const e of [0.42, 0.85, 1.2]) {
      const r = rIn * Math.cos(e) - 0.02, z = spring + rIn * Math.sin(e);
      C.kit.geo(lathe([[r, -0.12], [r - 0.12, -0.06], [r - 0.12, 0.06], [r, 0.12]], [c[0], c[1], z], nA), 'marble_white', { collide: false, castShadow: false });
    }
  }
}

// ---------------------------------------------------------------------------------- rovadin, slab, hearth
function furnishings(C) {
  const { i, Z, c } = geom(C);
  const ky = C.el('azarah.moked.hall').params.kodeshLine.y;
  // rovadin: three ledges of ½ rise ringing the hall where the walls are free (E and W, between the corner chambers);
  // the elders sleep on them in the chol half (Yoma 25a: no sitting in kodesh) ⚙ depth 1 each
  const ch = C.el('azarah.moked.chamber.lambs').box;
  const y0 = ch.max[1], y1 = C.el('azarah.moked.chamber.tevilah-descent').box.min[1];
  const adds = [];
  for (let k = 0; k < 3; k++) {
    const d = 3 - k;
    adds.push(B(i.min[0], y0, Z, i.min[0] + d, y1, Z + 0.5 * (k + 1), { top: 'ashlar_plain', side: 'ashlar_plain' }));
    adds.push(B(i.max[0] - d, y0, Z, i.max[0], y1, Z + 0.5 * (k + 1), { top: 'ashlar_plain', side: 'ashlar_plain' }));
  }
  C.kit.solid(gridSolid(adds, [], classify), true, true);
  // rashei pispasin across the hall on the kodesh/chol line (Middot 1:6)
  const ph = C.kit.m('marble_veined', false, true);
  for (let x = i.min[0] + 3.5; x < i.max[0] - 3; x += 1) ph.box([x - 0.15, ky - 0.15, Z], [x + 0.15, ky + 0.15, Z + 0.07]);
  // the keys slab: marble, an amah square, a ring fixed in it (Middot 1:9)
  const ks = C.el('azarah.moked.keys-slab').box;
  C.kit.m('marble_white', true, true).box([ks.min[0] + 0.02, ks.min[1] + 0.02, ks.min[2]], [ks.max[0] - 0.02, ks.max[1] - 0.02, ks.max[2]]);
  const ring = new TorusGeometry(0.16 * AMAH, 0.03 * AMAH, 6, 16);
  ring.rotateX(Math.PI / 2);
  const rp = m2w((ks.min[0] + ks.max[0]) / 2, (ks.min[1] + ks.max[1]) / 2, ks.max[2] + 0.03);
  ring.translate(rp.x, rp.y, rp.z);
  C.kit.geo(ring, 'iron', { collide: false });
  // the hearth (the moked): a stone kerb with embers and a star fire of round logs, in the chol half where everyone it
  // warms sits and sleeps (no sitting in the kodesh half — Yoma 25a), north of the keys slab in the bay before the door
  // to the chel ⚙ (site.js: "centre of the hall", which is the kodesh line and the slab)
  const hx = c[0], hy = ky + 5;
  C.kit.geo(lathe([[0.95, 0], [1.35, 0], [1.35, 0.45], [1.2, 0.55], [0.95, 0.5]], [hx, hy, Z], C.d >= 2 ? 24 : 14), 'ashlar_plain', { collide: true });
  C.kit.geo(lathe([[0, 0.02], [1.0, 0.02], [0.9, 0.18], [0, 0.22]], [hx, hy, Z], 14), 'ash', { collide: false });
  starFire(C, [hx, hy], Z + 0.2, Z + 0.52, 1.35, 5, 3, 0.17);
  C.ctx.addFire({ id: 'courts.moked.hearth', kind: 'hearth', pos: [hx, hy, Z + 0.35], size: 0.8, intensity: 0.85, schedule: 'always', smoke: true });
  // the kohanic night post (Middot 1:1): a lamp on a stand before the west ledges, clear of the corner chambers' doors
  lampStand(C, 'courts.watch.beit-hamoked', i.min[0] + 3.6, ky + 0.8, Z, { schedule: 'night' });
  C.anchor('courts.moked.hall', [c[0], i.min[1] + 4.5, Z], 0, 'Beit HaMoked — the hall');
  C.anchor('courts.moked.keys', [(ks.min[0] + ks.max[0]) / 2, ks.max[1] + 1.6, Z], 180, 'Beit HaMoked — the keys slab');
  C.anchor('courts.moked.ledges', [c[0] - 3, ky + 2, Z], 270, 'Beit HaMoked — the rovadin (sleeping ledges)');
}

// -------------------------------------------------------------------------------------- corner chambers
function cornerChambers(C) {
  const { Z } = geom(C);
  const tw = 0.5;
  for (const key of ['lambs', 'showbread', 'altar-stones', 'tevilah-descent']) {
    const e = C.el(`azarah.moked.chamber.${key}`), b = e.box;
    const west = b.min[0] < 205, south = b.min[1] < 400;
    // the two inner walls (the others are the hall's), a roof slab; the door faces the hall's E–W bay
    const xw = west ? [b.max[0] - tw, b.max[0]] : [b.min[0], b.min[0] + tw];
    const yw = south ? [b.max[1] - tw, b.max[1]] : [b.min[1], b.min[1] + tw];
    const adds = [
      B(xw[0], b.min[1], Z, xw[1], b.max[1], b.max[2]), B(b.min[0], yw[0], Z, b.max[0], yw[1], b.max[2]),
      { ...B(b.min[0], b.min[1], b.max[2] - 0.5, b.max[0], b.max[1], b.max[2]), top: 'ashlar_plain' },
    ];
    // the door at the corridor end of the wall, clear of the rovadin along the hall's side walls
    const dx = west ? b.max[0] - 1.25 : b.min[0] + 1.25;
    const subs = [B(dx - 0.75, yw[0] - 0.01, Z - 0.01, dx + 0.75, yw[1] + 0.01, Z + 6.5, { mat: 'marble_white' })];
    if (key === 'lambs') {
      // "cut off at the corner" (Yoma 17a; lock #8): the hall-facing corner is splayed — built as a diagonal wall
      adds.length = 1;
      const m = C.kit.m('ashlar_plain', true, true);
      adds[0] = B(xw[0], b.min[1], Z, xw[1], b.max[1] - 2, b.max[2]);
      adds.push(B(b.min[0], yw[0], Z, b.max[0] - 2, yw[1], b.max[2]));
      adds.push({ ...B(b.min[0], b.min[1], b.max[2] - 0.5, b.max[0], b.max[1], b.max[2]), top: 'ashlar_plain' });
      subs.length = 0;
      // the diagonal with its door: two short wall pieces and a lintel
      const pA = [b.max[0] - 0.25, b.max[1] - 2], pB = [b.max[0] - 2, b.max[1] - 0.25];
      const mid = [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2];
      const L = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]), u = [(pB[0] - pA[0]) / L, (pB[1] - pA[1]) / L];
      const dw = 0.75;
      const e1 = [mid[0] - u[0] * dw, mid[1] - u[1] * dw], e2 = [mid[0] + u[0] * dw, mid[1] + u[1] * dw];
      m.beam([pA[0] - u[0] * 0.3, pA[1] - u[1] * 0.3, Z + (b.max[2] - Z) / 2], [e1[0], e1[1], Z + (b.max[2] - Z) / 2], b.max[2] - Z, tw, [1, 0, 0]);
      m.beam([e2[0], e2[1], Z + (b.max[2] - Z) / 2], [pB[0] + u[0] * 0.3, pB[1] + u[1] * 0.3, Z + (b.max[2] - Z) / 2], b.max[2] - Z, tw, [1, 0, 0]);
      m.beam([e1[0], e1[1], (Z + 6.5 + b.max[2]) / 2], [e2[0], e2[1], (Z + 6.5 + b.max[2]) / 2], b.max[2] - Z - 6.5, tw, [1, 0, 0]);
      // a manger and a water trough for the inspected lambs (Arachin 2:5; Tamid 3:4) ⚙
      const st = C.kit.m('ashlar_plain', true, true);
      st.box([b.min[0] + 0.1, b.min[1] + 0.2, Z], [b.min[0] + 1.1, b.max[1] - 2.5, Z + 1.1]);
    }
    C.kit.solid(gridSolid(adds, subs, (f) => (f.sub?.mat ? f.sub.mat : f.axis === 2 ? (f.dir > 0 ? 'ashlar_plain' : 'plaster') : 'ashlar_plain')), true, true);
    // the door's cedar leaf (Middot 2:3 — every opening there had doors): the lamb chamber's opens in through its
    // splay; the others open out into the hall and fold back against the ledges' ends (the NW one would otherwise
    // hang over its stair) ⚙
    const id = `azarah.moked.chamber.${key}`;
    if (key === 'lambs') {
      const pA = [b.max[0] - 0.25, b.max[1] - 2], pB = [b.max[0] - 2, b.max[1] - 0.25];
      const L = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]), u = [(pB[0] - pA[0]) / L, (pB[1] - pA[1]) / L];
      const mid = [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2];
      C.doorSingle(id, 'cedarSmall', [mid[0] - u[0] * 0.75, mid[1] - u[1] * 0.75, Z], u, [-u[1], u[0]].map((v) => -Math.abs(v)), 1.5, 6.5, { open: 1, label: e.name.en });
    } else {
      const face = south ? yw[1] : yw[0], out = south ? 1 : -1;
      const hingeX = west ? dx - 0.73 : dx + 0.73;
      C.doorSingle(id, 'cedarSmall', [hingeX, face + out * 0.2, Z], [west ? 1 : -1, 0], [0, out], 1.5, 6.5, { open: 1, label: e.name.en });
    }
    if (key === 'showbread') {
      // Beit Garmu's bakery (Yoma 38a): a domed oven and a kneading table ⚙
      C.kit.geo(lathe([[0, 0], [1.3, 0], [1.3, 0.8], [1.15, 1.5], [0.8, 2.0], [0.35, 2.25], [0, 2.3]], [(b.min[0] + b.max[0]) / 2 + 0.6, b.min[1] + 1.6, Z], C.d >= 2 ? 18 : 10), C.kit.mat('terracotta', 'plaster'), { collide: true });
      C.kit.m('cedar', true, true).box([b.min[0] + 0.6, b.max[1] - 2.2, Z], [b.max[0] - 0.6, b.max[1] - 1.2, Z + 1.7]);
    }
    if (key === 'altar-stones') {
      // the stones of the altar defiled by the Greek kings, stored away (Middot 1:6) — whitewashed field-stones
      let s = 3;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const st = C.kit.m('lime_whitewash', true, true);
      for (let k = 0; k < (C.d >= 1 ? 22 : 8); k++) {
        const x = b.min[0] + 0.6 + rnd() * 3.6, y = b.min[1] + 1.2 + rnd() * 3.8, sz = 0.5 + rnd() * 0.5, z = Z + Math.floor(k / 8) * 0.55;
        st.boxRot([x, y, z + sz * 0.45], [sz, sz * 0.8, sz * 0.9], rnd() * Math.PI);
      }
    }
    C.anchor(`courts.moked.chamber.${key}`, [dx, south ? b.max[1] + 2 : b.min[1] - 2, Z], south ? 180 : 0, e.name.en);
  }
}

// ---------------------------------------------------------------------------- the gate, wicket and chel door
function gates(C) {
  const { Z } = geom(C);
  const g = C.el('azarah.gate.moked'), gb = g.box, pk = g.params.pishpash.box;
  const cx = (gb.min[0] + gb.max[0]) / 2;
  const hingeY = gb.min[1] + 0.25;
  // west leaf: a standard gold leaf; east leaf: its own mesh with the wicket cut in it (R. Yehudah, Middot 1:7)
  const w = 5 - 0.02, h = 20, t = 0.4;
  const set = C.leafSet('goldLeaf', w, h);
  const local0 = gb.max[0] - pk.max[0], local1 = gb.max[0] - pk.min[0];   // the wicket along the east leaf from its hinge
  const eastGeo = leafGeometry(w, h, t, 'gate', C.d, [[local0, 0, local1, pk.max[2] - pk.min[2]]]);
  const east = new Object3D();
  east.name = 'courts:moked-east-leaf';
  const eastMesh = meshOf(C.kit, eastGeo, 'gold_plate', 'courts:moked-east-leaf-mesh');
  eastMesh.matrixAutoUpdate = true;
  east.add(eastMesh);
  // the wicket leaf: hinged on the leaf at local x = local1, swinging into the hall (the leaf's +z side when shut)
  const wk = new Object3D();
  wk.position.set(local1 * AMAH, 0, 0);
  const wkMesh = meshOf(C.kit, leafGeometry(local1 - local0 - 0.04, pk.max[2] - pk.min[2] - 0.02, 0.3, 'gate', C.d), 'gold_plate', 'courts:moked-pishpash');
  wkMesh.matrixAutoUpdate = true;
  wk.add(wkMesh);
  wk.rotation.y = Math.PI;
  east.add(wk);
  C.doors.addDoor('azarah.gate.moked', [
    { set, hinge: [gb.min[0], hingeY, Z], along: [1, 0], into: [0, 1] },
    { object: east, hinge: [gb.max[0], hingeY, Z], along: [-1, 0], into: [0, 1] },
  ], { open: 0, center: [cx, hingeY, Z], label: "Sha'ar Beit HaMoked" });
  const node = new Object3D();
  node.name = 'door:azarah.gate.moked.pishpash';
  node.userData = {
    kind: 'wicket', id: 'azarah.gate.moked.pishpash', label: 'The pishpash of the Moked gate (Middot 1:7)', f: 0,
    get openAmount() { return node.userData.f; },
    open(f) { const v = Math.min(1, Math.max(0, +f || 0)); node.userData.f = v; wk.rotation.y = Math.PI + v * Math.PI / 2; return v; },
  };
  node.position.copy(m2w((pk.min[0] + pk.max[0]) / 2, hingeY, Z));
  C.kit.group.add(node);
  C.ctx.movables.set(node.name, node);
  C.curtain('azarah.gate.moked', [gb.min[0] - 1, gb.min[1] - 0.45, Z], [1, 0], "Sha'ar Beit HaMoked");
  // the door to the chel and its flight (Middot 1:7; EK I 202–215)
  const dc = C.el('azarah.moked.door-chel').box;
  C.doorPair('azarah.moked.door-chel', 'goldLeaf', dc.min[0], dc.max[0], 'x', dc.max[1] - 0.25, Z, [0, -1], { open: 0, label: 'Beit HaMoked — door to the chel' });
  const fl = C.el('azarah.moked.flight');
  flight(C, { axis: 'y', head: dc.max[1], dir: 1, c0: fl.box.min[0], c1: fl.box.max[0], steps: fl.params.steps, zTop: Z });
  C.anchor('courts.gate.moked', [cx, gb.min[1] - 6, Z], 0, "Sha'ar Beit HaMoked");
  C.anchor('courts.gate.moked.chel', [cx, fl.box.max[1] + 3, 0], 180, 'Beit HaMoked — the door to the chel');
}

// ------------------------------------------------------------------------------------------ underground
function underground(C) {
  const st = C.el('azarah.underground.stair'), sp = st.params;
  const pa = C.el('azarah.underground.passage').box, tv = C.el('azarah.underground.beit-hatevilah'), tb = tv.box, tp = tv.params;
  const zF = tp.floorZ, Zaz = C.datums.azarah;
  // the winding stair (Middot 1:6, 1:9): from the NW chamber down through the podium to the passage. Four full turns;
  // its head is a landing step widened round the south of the shaft to the chamber's door (the floor bridges the last
  // half amah — masonry.buildFloors), the descent turning anticlockwise from it ⚙
  spiral(C, { c: sp.center, r1: Math.min(st.box.max[0] - sp.center[0], st.box.max[1] - sp.center[1]) - 0.05, z0: st.box.min[2], z1: Zaz,
    perTurn: 14, a0: (-40 * Math.PI) / 180, cw: true, mat: 'steps_stone', landing: 3.5, landingMat: 'marble_white' });
  // rock and masonry round the shaft, the passage and the immersion house (top kept under the Mount pavement)
  const vSpring = pa.max[2] - (pa.max[0] - pa.min[0]) / 2;
  const adds = [
    { ...B(pa.min[0] - 2, st.box.min[1] - 2, zF - 2, pa.max[0] + 2, pa.max[1] + 2, -1.2), top: 'ashlar_plain', side: 'ashlar_plain' },
    { ...B(tb.min[0] - 2, tb.min[1] - 1, tb.min[2] - 2, tb.max[0] + 2, tb.max[1] + 2, -1.2), top: 'ashlar_plain', side: 'ashlar_plain' },
  ];
  const subs = [
    B(st.box.min[0], st.box.min[1], st.box.min[2], st.box.max[0], st.box.max[1], 0.5, { room: 'ashlar_plain', floor: 'paving_mount' }),
    B(pa.min[0], st.box.max[1] - 0.5, zF, pa.max[0], tb.min[1] + 0.01, pa.max[2], { room: 'ashlar_plain', floor: 'paving_mount', ceil: 'ashlar_plain' }),
    B(tb.min[0], tb.min[1], zF, tb.max[0], tb.max[1], tb.max[2], { room: 'plaster', floor: 'paving_mount', ceil: 'plaster' }),
  ];
  // lamps in niches on both sides of the passage (Tamid 1:1 "the lamps burning on this side and on that")
  const lampYs = [];
  for (let y = st.box.max[1] + 3; y < tb.min[1] - 1.5; y += 4) lampYs.push(y);
  const nz = zF + 2.6, nw = 0.9, nh = 1.1, nd = 0.6;
  for (const y of lampYs) {
    subs.push(B(pa.min[0] - nd, y - nw / 2, nz, pa.min[0] + 0.01, y + nw / 2, nz + nh, { mat: 'plaster' }));
    subs.push(B(pa.max[0] - 0.01, y - nw / 2, nz, pa.max[0] + nd, y + nw / 2, nz + nh, { mat: 'plaster' }));
  }
  // the mikveh (≥ 1 × 1 × 3 — Yoma 31a), carved as stepped columns down from its east side
  const mk = tp.mikveh;
  const water = zF - 0.25, bot = water - 3;
  for (let c = 0; c < 5; c++) subs.push(B(mk.max[0] - 0.6 * (c + 1), mk.min[1], zF - 0.5 * (c + 1), mk.max[0] - 0.6 * c, mk.max[1], zF + 0.01, { room: 'plaster', floor: 'plaster' }));
  subs.push(B(mk.min[0], mk.min[1], bot, mk.max[0] - 3, mk.max[1], zF + 0.01, { room: 'plaster', floor: 'plaster' }));
  adds.push({ ...B(mk.min[0] - 0.6, mk.min[1] - 0.6, bot - 0.6, mk.max[0] + 0.6, mk.max[1] + 0.6, zF), top: 'paving_mount', side: 'plaster' });
  C.kit.solid(gridSolid(adds, subs, classify), true, true);
  C.kit.m('water', false, false).box([mk.min[0], mk.min[1], water], [mk.max[0], mk.max[1], water], 'Z');
  // the passage vault (barrel, springing at the walls' head) — overhead, not a collider
  const vm = C.kit.m('ashlar_plain', false, false);
  const rv = (pa.max[0] - pa.min[0]) / 2, cxv = (pa.min[0] + pa.max[0]) / 2, nv = [6, 10, 14, 18][C.d] || 10;
  const y0 = st.box.max[1] - 0.5, y1 = tb.min[1];
  for (let k = 0; k < nv; k++) {
    const a0 = (Math.PI * k) / nv, a1 = (Math.PI * (k + 1)) / nv;
    const P = (a, y) => [cxv + rv * Math.cos(a), y, vSpring + rv * Math.sin(a)];
    const N = (a) => [-Math.cos(a), 0, -Math.sin(a)];
    vm.triN(P(a0, y0), P(a1, y0), P(a1, y1), N(a0), N(a1), N(a1));
    vm.triN(P(a0, y0), P(a1, y1), P(a0, y1), N(a0), N(a1), N(a0));
  }
  // niche linings are part of the solid; the lamps in them
  lampYs.forEach((y, k) => {
    lamp(C, `courts.passage.lamp-w${k}`, pa.min[0] - nd / 2, y, nz, { heading: 90, schedule: 'always' });
    lamp(C, `courts.passage.lamp-e${k}`, pa.max[0] + nd / 2, y, nz, { heading: 270, schedule: 'always' });
  });
  // ---- Beit HaTevilah: the medurah (fire to warm himself), benches, the privy of honour (Tamid 1:1)
  const [fx, fy] = tp.medurah;
  C.kit.geo(lathe([[0.8, 0], [1.2, 0], [1.2, 0.5], [1.05, 0.6], [0.8, 0.55]], [fx, fy, zF], 14), 'ashlar_plain', { collide: true });
  C.kit.geo(lathe([[0, 0.02], [0.85, 0.02], [0.75, 0.15], [0, 0.2]], [fx, fy, zF], 12), 'ash', { collide: false });
  starFire(C, [fx, fy], zF + 0.18, zF + 0.52, 1.15, 4, 11, 0.15);
  C.ctx.addFire({ id: 'courts.beit-hatevilah.medurah', kind: 'hearth', pos: [fx, fy, zF + 0.35], size: 0.6, intensity: 0.8, schedule: 'always', smoke: true });
  const stone = C.kit.m('ashlar_plain', true, true);
  stone.box([tb.max[0] - 1.6, tb.min[1] + 1, zF], [tb.max[0] - 0.01, tb.min[1] + 8, zF + 1]);
  stone.box([fx - 3.5, fy + 2.4, zF], [fx + 1.5, fy + 3.6, zF + 1]);
  const pr = tp.beitKisseShelKavod;
  shell(C, B(...pr.min, ...pr.max), { t: 0.4, room: 'plaster', top: 'plaster', side: 'plaster', floor: 'paving_mount',
    doors: [B(pr.min[0] + 0.6, pr.min[1] - 0.01, pr.min[2] - 0.01, pr.min[0] + 2.2, pr.min[1] + 0.41, pr.min[2] + 4.5, { mat: 'plaster' })] });
  stone.box([pr.min[0] + 0.4, pr.max[1] - 1.6, zF], [pr.max[0] - 0.4, pr.max[1] - 0.4, zF + 1.0]);
  C.doorSingle('azarah.underground.privy', 'cedarSmall', [pr.min[0] + 0.6, pr.min[1] + 0.2, zF], [1, 0], [0, 1], 1.6, 4.5, { open: 0.3 });
  // wall lamps in the immersion house
  wallLamp(C, 'courts.beit-hatevilah.lamp-w', tb.min[0], (tb.min[1] + tb.max[1]) / 2, zF + 3.5, [1, 0], { schedule: 'always' });
  wallLamp(C, 'courts.beit-hatevilah.lamp-e', tb.max[0], (tb.min[1] + tb.max[1]) / 2 - 3, zF + 3.5, [-1, 0], { schedule: 'always' });
  wallLamp(C, 'courts.beit-hatevilah.lamp-n', (tb.min[0] + tb.max[0]) / 2 - 3, tb.max[1], zF + 3.5, [0, -1], { schedule: 'always' });
  C.anchor('courts.underground.stair', [sp.center[0] + 1.2, st.box.min[1] - 1, Zaz], 0, 'The winding stair down to the Beit HaTevilah');
  C.anchor('courts.underground.passage', [(pa.min[0] + pa.max[0]) / 2, st.box.max[1] + 4, zF], 0, 'The passage under the Birah');
  C.anchor('courts.beit-hatevilah', [(pa.min[0] + pa.max[0]) / 2, tb.min[1] + 1.5, zF], 0, 'Beit HaTevilah');
}

// The five gates of Har HaBayit (Middot 1:3, 2:3): gold-plated double doors (movables 'door:<gate id>'), marble jamb
// facings and a single-stone lintel (shekufah) on both faces of the Mount-level gates — except Tadi, whose head is
// two leaning stones (walls.js) —, and the Shushan HaBirah chamber over the Eastern Gate (mount.gate.shushan.chamber)
// with the image of Shushan the capital on its east face (Middot 1:3) and the two standard amot of Kelim 17:9 inside.
import { Group, Mesh, BoxGeometry, Vector3 } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { mergeGeometries, applyWorldUV } from '../geom.js';
import { siteDir, worldQuad } from './kit.js';
import { wallDesc } from './walls.js';

const GATES = ['mount.gate.shushan', 'mount.gate.kiponus', 'mount.gate.tadi', 'mount.gate.chuldah-w', 'mount.gate.chuldah-e'];
const SIDE_OF = { 'mount.gate.shushan': 'east', 'mount.gate.kiponus': 'west', 'mount.gate.tadi': 'north', 'mount.gate.chuldah-w': 'south', 'mount.gate.chuldah-e': 'south' };

export function buildGates(ctx, kit, group, detail) {
  const doors = {};
  const zMount = ctx.el('mount.floor').box.max[2];
  for (const id of GATES) {
    const W = wallDesc(ctx, SIDE_OF[id]);
    const o = W.openings.find((x) => x.id === id);
    const { pt, tExt, tInt, extSign } = W;
    // marble surround: jamb facings + lintel (none at Tadi: its leaning stones are the head) on the outer face, and
    // on the inner face of the gates that open at the Mount level (the Chuldah passages' inner faces are underground)
    if (detail >= 1 && !o.tadi) {
      const F = 1.2, PJ = 0.14, PL = 0.22;
      const box = (s0, s1, t0, t1, z0, z1, key) => {
        const a = pt(s0, Math.min(t0, t1), z0), b = pt(s1, Math.max(t0, t1), z1);
        kit.box([Math.min(a[0], b[0]), Math.min(a[1], b[1]), z0], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), z1], key, { collide: false });
      };
      const faces = [[tExt, extSign]];
      if (Math.abs(o.z0 - zMount) < 1e-6) faces.push([tInt, -extSign]);
      for (const [t, sg] of faces) {
        box(o.s0 - F, o.s0, t, t + sg * PJ, o.z0, o.z1, 'marble_white');
        box(o.s1, o.s1 + F, t, t + sg * PJ, o.z0, o.z1, 'marble_white');
        const lintelTop = Math.min(o.z1 + 2, W.top - 0.72);
        box(o.s0 - F - 0.2, o.s1 + F + 0.2, t, t + sg * PL, o.z1, lintelTop, 'marble_white');
        // a thin moulded drip over the lintel
        box(o.s0 - F - 0.35, o.s1 + F + 0.35, t, t + sg * (PL + 0.12), lintelTop - 0.18, lintelTop, 'marble_white');
      }
    }
    doors[id] = makeDoors(ctx, id, W, o, detail);
    group.add(doors[id]);
    ctx.movables.set(`door:${id}`, doors[id]);
  }
  return doors;
}

/** Two gold-plated leaves hung 0.6 amah inside the outer face, opening inward to fold against the jambs. */
function makeDoors(ctx, id, W, o, detail) {
  const A = AMAH;
  const T = 0.55;                                             // leaf thickness (amot) ⚙
  const tH = W.tExt - W.extSign * (0.6 + T / 2);
  const half = (o.s1 - o.s0) / 2;
  const wL = half - 0.05, h = o.z1 - o.z0 - 0.04;             // a 0.1-amah meeting joint, closed by the astragal
  const hs = o.tadi ? o.z1 - half - o.z0 - 0.04 : h;           // Tadi: leaves follow the pointed head
  const leafGeo = leafGeometry(wL * A, h * A, hs * A, T * A, detail);
  const mat = ctx.mats.get('gold_plate');
  const grp = new Group();
  grp.name = `door:${id}`;
  const sDir = siteDir(W.nS(1)), inDir = siteDir(W.nT(-W.extSign));
  const pivots = [];
  for (const sgn of [1, -1]) {
    const sh = sgn > 0 ? o.s0 + 0.03 : o.s1 - 0.03;
    const p = new Group();
    p.position.copy(m2w(...W.pt(sh, tH, o.z0 + 0.02)));
    const closed = sDir.clone().multiplyScalar(sgn);
    const th0 = Math.atan2(-closed.z, closed.x);
    const th1 = Math.atan2(-inDir.z, inDir.x);
    let d = th1 - th0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    p.userData = { th0, d };
    p.rotation.y = th0;
    const leaf = new Mesh(leafGeo, mat);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.name = `${id}:leaf${sgn > 0 ? 'L' : 'R'}`;
    p.add(leaf);
    grp.add(p);
    pivots.push(p);
  }
  grp.userData = {
    kind: 'door', gate: id, amount: 0, leaves: pivots,
    pivot: 'each leaf turns about a vertical hinge at its jamb, 0.6 amah inside the outer face; open(1) folds both leaves inward against the jambs',
    open(f) {
      const v = Math.max(0, Math.min(1, f));
      grp.userData.amount = v;
      for (const p of pivots) p.rotation.y = p.userData.th0 + p.userData.d * v;
    },
    /** 0 shut … 1 open (the contract the other builders and env/interiors read) */
    get openAmount() { return grp.userData.amount; },
  };
  grp.userData.open(0);
  return grp;
}

/**
 * Leaf in local metres: x 0..w (hinge at 0, meeting stile at w), y 0..top(x), z centred (thickness t); hs = height at
 * the hinge side (pointed heads). Framed and panelled ⚙: stiles and rails at full thickness, a heavier bottom rail,
 * tall panels recessed 9 cm on both faces inside a bevelled edge, a meeting astragal on the +z face that closes the
 * joint, and (detail ≥ 2) rows of nail-head bosses on the stiles and rails.
 */
function leafGeometry(w, h, hs, t, detail) {
  const parts = [];
  const V = (x, y, z) => new Vector3(x, y, z);
  const q = (a, b, c, d, n) => parts.push(worldQuad(a, b, c, d, n));
  const top = (x) => hs + (h - hs) * (x / w);
  const sw = 0.36, rT = 0.36, rB = 0.62, rM = 0.3, bev = 0.06, rec = 0.09;
  const c = Math.max(0.04, t - 2 * rec);
  const yTR = Math.min(hs, h) - rT;
  const nP = Math.max(2, Math.round((yTR - rB) / 3.0));
  const pH = (yTR - rB - (nP - 1) * rM) / nP;
  const ops = [];
  for (let i = 0; i < nP; i++) { const y0 = rB + i * (pH + rM); ops.push([sw, y0, w - sw, y0 + pH]); }
  for (const zs of [1, -1]) {
    const zf = zs * t / 2, zp = zs * c / 2, n = V(0, 0, zs);
    // frame face: stiles, rails, the head
    q(V(0, 0, zf), V(sw, 0, zf), V(sw, yTR, zf), V(0, yTR, zf), n);
    q(V(w - sw, 0, zf), V(w, 0, zf), V(w, yTR, zf), V(w - sw, yTR, zf), n);
    q(V(sw, 0, zf), V(w - sw, 0, zf), V(w - sw, rB, zf), V(sw, rB, zf), n);
    for (let i = 0; i + 1 < nP; i++) q(V(sw, ops[i][3], zf), V(w - sw, ops[i][3], zf), V(w - sw, ops[i + 1][1], zf), V(sw, ops[i + 1][1], zf), n);
    q(V(0, yTR, zf), V(w, yTR, zf), V(w, top(w), zf), V(0, top(0), zf), n);
    // bevelled edges into each recessed panel, and the panel
    for (const [x0, y0, x1, y1] of ops) {
      const X0 = x0 + bev, X1 = x1 - bev, Y0 = y0 + bev, Y1 = y1 - bev;
      q(V(X0, Y0, zp), V(X1, Y0, zp), V(X1, Y1, zp), V(X0, Y1, zp), n);
      q(V(x0, y0, zf), V(x1, y0, zf), V(X1, Y0, zp), V(X0, Y0, zp), V(0, 1, zs));
      q(V(x0, y1, zf), V(x1, y1, zf), V(X1, Y1, zp), V(X0, Y1, zp), V(0, -1, zs));
      q(V(x0, y0, zf), V(x0, y1, zf), V(X0, Y1, zp), V(X0, Y0, zp), V(1, 0, zs));
      q(V(x1, y0, zf), V(x1, y1, zf), V(X1, Y1, zp), V(X1, Y0, zp), V(-1, 0, zs));
    }
  }
  // the leaf's edges
  const T2 = t / 2;
  q(V(0, 0, -T2), V(0, 0, T2), V(0, top(0), T2), V(0, top(0), -T2), V(-1, 0, 0));
  q(V(w, 0, -T2), V(w, 0, T2), V(w, top(w), T2), V(w, top(w), -T2), V(1, 0, 0));
  q(V(0, 0, -T2), V(w, 0, -T2), V(w, 0, T2), V(0, 0, T2), V(0, -1, 0));
  q(V(0, top(0), -T2), V(w, top(w), -T2), V(w, top(w), T2), V(0, top(0), T2), V(0, 1, 0));
  const boxAt = (x0, x1, y0, y1, z0, z1) => {
    const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parts.push(g.toNonIndexed());
  };
  // meeting astragal (+z face): covers the joint and laps 0.07 amah over the other leaf
  const A = AMAH, ov = 0.12 * A;
  boxAt(w - 0.06, w + ov, 0.03, top(w) - 0.03, T2, T2 + 0.045);
  if (detail >= 2) {
    // nail-head bosses on the stiles and rails, both faces
    const b = 0.035, step = 0.42;
    for (const zs of [1, -1]) {
      const z0 = zs > 0 ? T2 : -T2 - 0.025, z1 = z0 + 0.025;
      for (const xs of [sw / 2, w - sw / 2]) for (let y = rB / 2; y < yTR; y += step) boxAt(xs - b, xs + b, y - b, y + b, z0, z1);
      const rails = [rB / 2, yTR + rT / 2, ...ops.slice(0, -1).map((op, i) => (op[3] + ops[i + 1][1]) / 2)];
      for (const y of rails) for (let x = sw + step / 2; x < w - sw; x += step) boxAt(x - b, x + b, y - b, y + b, z0, z1);
    }
  }
  const g = mergeGeometries(parts.map((p) => { const q2 = p.index ? p.toNonIndexed() : p; if (q2.attributes.uv) q2.deleteAttribute('uv'); return q2; }), false);
  return applyWorldUV(g);
}

/** The Shushan HaBirah chamber over the Eastern Gate, its relief and the two amot (reached from the raised gate bay). */
export function buildShushanChamber(ctx, kit, detail) {
  const e = ctx.el('mount.gate.shushan.chamber');
  const b = e.box, p = e.params, wt = p.wallT;
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const roofT = 1;
  const zc = z1 - roofT;                                        // ceiling
  const zw = zc + 0.05;                                         // walls run into the roof slab (no light leak at the joint)
  // walls: east (relief face), north, south — full; west with a door
  const door = { y0: (y0 + y1) / 2 - 1, y1: (y0 + y1) / 2 + 1, z1: z0 + 4.2 };
  const ext = 'herodian_wall', inn = 'plaster';
  kit.faces([x1 - wt, y0, z0], [x1, y1, zw], { e: ext, w: inn });
  kit.faces([x0, y0, z0], [x1, y0 + wt, zw], { s: ext, n: inn, w: ext });
  kit.faces([x0, y1 - wt, z0], [x1, y1, zw], { n: ext, s: inn, w: ext });
  // west wall pieces round the door
  kit.faces([x0, y0 + wt, z0], [x0 + wt, door.y0, zw], { w: 'herodian_wall_inner', e: inn, n: 'herodian_wall_inner' });
  kit.faces([x0, door.y1, z0], [x0 + wt, y1 - wt, zw], { w: 'herodian_wall_inner', e: inn, s: 'herodian_wall_inner' });
  kit.faces([x0, door.y0, door.z1], [x0 + wt, door.y1, zw], { w: 'herodian_wall_inner', e: inn, b: 'ashlar_plain' });
  // roof slab with a plain projecting edge, ceiling of cedar boards
  kit.faces([x0 - 0.3, y0 - 0.3, zc], [x1 + 0.3, y1 + 0.3, z1], { t: 'roof_tile', e: 'ashlar_plain', w: 'ashlar_plain', n: 'ashlar_plain', s: 'ashlar_plain', b: 'ashlar_plain' });
  kit.quad([[x0 + wt, y0 + wt, zc - 0.01], [x1 - wt, y0 + wt, zc - 0.01], [x1 - wt, y1 - wt, zc - 0.01], [x0 + wt, y1 - wt, zc - 0.01]], [0, 0, -1], 'cedar', { collide: false });
  // the two standard amot (Kelim 17:9): bronze rods on the inner face of the east wall, at the NE and SE corners ⚙ form
  const rodT = 0.05;
  for (const k of ['ne', 'se']) {
    const r = p.standardAmot[k];
    const [rx, ry, rz] = r.at;
    const ya = k === 'ne' ? ry - r.lengthAmot : ry, yb = k === 'ne' ? ry : ry + r.lengthAmot;
    kit.box([rx - 0.04 - rodT, ya, rz - rodT / 2], [rx - 0.04, yb, rz + rodT / 2], 'copper', { collide: false, castShadow: false });
    for (const ye of [ya, yb]) kit.box([rx - 0.12, ye - 0.025, rz - 0.06], [rx, ye + 0.025, rz + 0.06], 'copper', { collide: false, castShadow: false });
  }
  buildRelief(kit, x1, y0, y1, z0, z1, detail);
  return { door };
}

/**
 * The image of Shushan the capital (Middot 1:3) on the chamber's east face ⚙ design: a white-marble low relief on a
 * recessed kochla panel in a stepped marble frame — the city wall and its towers with plain coping lines (no merlons:
 * nothing crenellated on the Temple, Part VII §25), the gateway, and the palace terrace with six columns. Relief depth
 * reads in layers: towers 0.13, wall 0.08, palace 0.04–0.07. On low only a coarse silhouette (still the gate's mark).
 */
function buildRelief(kit, fx, y0, y1, z0, z1, detail) {
  const P0 = { y: y0 + 1.5, z: z0 + 0.6 }, PW = (y1 - y0) - 3, PH = (z1 - z0) - 1.6;
  const opts = { collide: false, castShadow: false };
  const rel = (u0, v0, u1, v1, d, key = 'marble_white', faces = 'ensbt') => {
    const m = {};
    for (const f of faces) m[f] = key;
    kit.faces([fx, P0.y + u0, P0.z + v0], [fx + d, P0.y + u1, P0.z + v1], m, opts);
  };
  const FR = 0.35, FD = 0.2, PD = 0.06;
  rel(-FR, -FR, PW + FR, 0, FD); rel(-FR, PH, PW + FR, PH + FR, FD);   // frame
  rel(-FR, 0, 0, PH, FD); rel(PW, 0, PW + FR, PH, FD);
  if (detail >= 1) {                                                   // inner step of the frame (a stepped profile)
    const s = 0.12, d = 0.13;
    rel(0, 0, PW, s, d); rel(0, PH - s, PW, PH, d); rel(0, s, s, PH - s, d); rel(PW - s, s, PW, PH - s, d);
  }
  rel(0, 0, PW, PH, PD, 'marble_kochla', 'e');                         // recessed panel (front face only)
  const U = PW / 9, V = PH / 4.4;                                      // design grid 9 x 4.4
  const r = (u0, v0, u1, v1, d) => rel(u0 * U, v0 * V, u1 * U, v1 * V, PD + d);
  if (detail < 1) {
    // coarse silhouette: ground line, wall band, the two gate towers, the palace block and its entablature
    r(0.2, 0.15, 8.8, 0.35, 0.06);
    r(0.4, 0.35, 8.6, 1.6, 0.08);
    r(3.3, 0.35, 3.95, 2.45, 0.13); r(5.05, 0.35, 5.7, 2.45, 0.13);
    r(2.25, 1.85, 6.75, 3.55, 0.04);
    r(2.1, 3.55, 6.9, 4.1, 0.08);
    return;
  }
  r(0.2, 0.15, 8.8, 0.35, 0.06);                                       // ground line
  r(0.4, 0.35, 3.9, 1.6, 0.08); r(5.1, 0.35, 8.6, 1.6, 0.08);           // city wall either side of the gate
  r(3.9, 1.25, 5.1, 1.6, 0.08);                                        // over the gateway
  r(0.4, 1.6, 3.3, 1.72, 0.1); r(5.7, 1.6, 7.9, 1.72, 0.1);             // plain coping lines on the wall
  for (const [u0, u1, top] of [[0.3, 1.1, 2.2], [3.3, 3.95, 2.45], [5.05, 5.7, 2.45], [7.9, 8.7, 2.2]]) {
    r(u0, 0.35, u1, top, 0.13);                                        // towers
    r(u0 - 0.06, top, u1 + 0.06, top + 0.13, 0.15);                    // plain coping on each tower
  }
  r(2.0, 1.85, 7.0, 2.2, 0.04);                                        // palace terrace behind the wall
  for (let i = 0; i < 6; i++) { const u = 2.55 + i * 0.78; r(u - 0.1, 2.2, u + 0.1, 3.55, 0.07); r(u - 0.2, 3.55, u + 0.2, 3.72, 0.08); }   // columns + plain capitals
  r(2.25, 3.72, 6.75, 4.05, 0.08);                                     // entablature
  r(2.1, 4.05, 6.9, 4.15, 0.1);                                        // cornice
}

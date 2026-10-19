// The kiyor and Ben Katin's muchni (Middot 3:6; Tamid 1:4, 3:8; Yoma 37a–b; Zevachim 59a; Rambam BhB 3:18).
//
//   kiyor   altar.kiyor — a bronze laver (Shemot 30:18, 38:8) "between the Ulam and the altar, drawn south", 12 spigots
//           (dadim) so the twelve kohanim of the tamid sanctify at once (Yoma 37a); form ⚙: a deep basin on a stand
//           (kiyor ve-kano), the spigots low on the bowl so hands and feet are washed together; on a bronze lifting
//           platform set in a dressed-stone curb over the well (altar.kiyor.muchni params.well)
//   muchni  the wooden wheel-machine, itself chol, that sinks the kiyor into the well overnight so its water is not
//           disqualified by linah (Yoma 37a–b, Abaye; Tamid 3:8 — its wood heard to Yericho). Form ⚙: two oak trestles
//           south of the kiyor (params.wheel box) carrying a windlass (axle, rope drum, a spoked hand-wheel inside the
//           east trestle) and a braced boom over the kiyor with a head-sheave; the rope descends to a bronze bail that
//           is hooked into the laver's lugs only while it is lowered or raised (unhooked once it stands in place).
// Movables: 'altar.kiyor' (userData.raise(f): 1 = up, in use; 0 = sunk in the well; also turns the wheel, shows the
//           bail while f < 1 and the dark shaft mouth while the laver is down), 'wheel:altar.kiyor.muchni'
//           (userData.spin(rad) about its E–W axle).
// Collider: a static cylinder 'altar:kiyor' round the raised laver (it also fences the open shaft at night).
import { Group, Mesh, CylinderGeometry, CircleGeometry, TorusGeometry, CatmullRomCurve3, TubeGeometry, Vector3, BoxGeometry, Matrix4, PlaneGeometry } from 'three';
import { Mesher, latheLocal, torusUV } from './lib.js';
import { applyWorldUV, mergeGeometries } from '../geom.js';
import { AMAH } from '../../core/units.js';

export function buildKiyor(A) {
  const { el, d, B, ctx } = A;
  const k = el('altar.kiyor'), mu = el('altar.kiyor.muchni');
  const [cx, cy, cz] = k.params.center;
  const KR = k.params.diameter / 2, KH = k.box.max[2] - k.box.min[2];
  const s = AMAH;
  const seg = [16, 28, 44, 64][d];
  // weathered outdoor timber (the materials task's soreg wood) until a dedicated key exists
  const COP = 'copper', OAK = A.mat('timber_weathered', A.mat('wood_lattice', 'oak_milah')), OAKV = A.mat('timber_weathered_v', A.mat('wood_lattice_v', 'oak_milah_v'));
  const ROPE = A.mat('rope', 'curtain_linen');            // hemp; a fibre key until the materials task adds 'rope'
  const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);
  const wuv = (g) => applyWorldUV(nonIdx(g));             // flat-faced parts: world UVs per part, before merging

  // ---------------------------------------------------------------- the kiyor (local frame: origin at its foot centre, meters)
  const kiyor = new Group();
  kiyor.name = 'altar.kiyor';
  kiyor.position.set(cx * s, cz * s, -cy * s);
  const plat = 0.02;                                   // deck top a hair proud of the pavement (the curb is 0.03)
  const sc = KR / 2.0;                                 // profile authored for r = 2, h = 3
  const prof = [[1.32, 0], [1.36, 0.05], [1.3, 0.11], [1.12, 0.17], [0.86, 0.3], [0.72, 0.52], [0.66, 0.78], [0.7, 0.86], [0.92, 0.95],
    [1.25, 1.03], [1.62, 1.2], [1.86, 1.52], [1.95, 2.0], [1.95, 2.74], [1.99, 2.8], [2.0, 2.92], [1.96, 3.0], [1.9, 2.97], [1.89, 2.85],
    [1.885, 2.1], [1.8, 1.6], [1.58, 1.3], [1.2, 1.16], [0, 1.13]].map(([r, z]) => [r * sc, plat + z * KH / 3]);
  // the bowl and stand keep their own lathe UVs (no projection seam down the bowl); the one seam faces south (φ = 0),
  // toward the muchni's trestles
  const parts = [nonIdx(latheLocal(prof, seg))];
  // the lifting platform: a thick bronze plate filling the well mouth, its top edge chamfered
  const wb = mu.params.well;
  const pw = (wb.max[0] - wb.min[0] - 0.02) * s, pd = (wb.max[1] - wb.min[1] - 0.02) * s, ch = 0.025 * s;
  parts.push(wuv(new BoxGeometry(pw, 0.2 * s - ch, pd).translate(0, (plat - 0.1) * s - ch / 2, 0)));
  parts.push(wuv(new BoxGeometry(pw - 2 * ch, ch, pd - 2 * ch).translate(0, plat * s - ch / 2, 0)));
  for (const [ax, az, w, dd] of [[0, pd / 2 - ch / 2, pw - ch, ch], [0, -pd / 2 + ch / 2, pw - ch, ch], [pw / 2 - ch / 2, 0, ch, pd - ch], [-pw / 2 + ch / 2, 0, ch, pd - ch]]) {
    parts.push(wuv(new BoxGeometry(w, ch * 0.5, dd).translate(ax, plat * s - ch * 0.75, az)));
  }
  // 12 spigots (dadim) low on the bowl
  const zSp = plat + 1.5 * KH / 3, rIn = 1.86 * sc, rOut = 2.3 * sc;
  const spSeg = d >= 2 ? 10 : 6;
  for (let i = 0; i < 12; i++) {
    const a = (i + 0.5) * Math.PI / 6;
    const m = new Matrix4().makeRotationY(a);
    const pipe = new CylinderGeometry(0.05 * s, 0.05 * s, (rOut - rIn) * s, spSeg).rotateZ(Math.PI / 2).translate((rIn + rOut) / 2 * s, zSp * s, 0);
    const nozzle = new CylinderGeometry(0.045 * s, 0.035 * s, 0.18 * s, spSeg).translate(rOut * s, (zSp - 0.08) * s, 0);
    const boss = new CylinderGeometry(0.07 * s, 0.07 * s, 0.06 * s, spSeg).rotateZ(Math.PI / 2).translate((rIn + 0.04) * s, zSp * s, 0);
    const key = new BoxGeometry(0.03 * s, 0.1 * s, 0.03 * s).translate((rOut - 0.12) * s, (zSp + 0.08) * s, 0);
    const handle = new BoxGeometry(0.03 * s, 0.03 * s, 0.16 * s).translate((rOut - 0.12) * s, (zSp + 0.13) * s, 0);
    for (const g of [pipe, nozzle, boss, key, handle]) parts.push(wuv(g.applyMatrix4(m)));
  }
  // lifting lugs (E and W, under the rim)
  const zRim = plat + KH * 0.97;
  for (const sx of [-1, 1]) parts.push(wuv(new BoxGeometry(0.16 * s, 0.3 * s, 0.12 * s).translate(sx * 2.0 * sc * s, (zRim - 0.12) * s, 0)));
  const kMesh = new Mesh(mergeGeometries(parts, false), ctx.mats.get(COP));
  kMesh.name = 'altar.kiyor:bronze';
  kMesh.castShadow = true;
  kMesh.receiveShadow = true;
  kiyor.add(kMesh);
  // the bronze bail, hooked into the lugs only while the laver is lowered or raised (hidden once it stands in use, so
  // it never frames the basin like a cauldron's handle)
  const bailTop = zRim + 1.35, ringR = 0.12;
  const bailCurve = new CatmullRomCurve3([-1, -0.7, 0, 0.7, 1].map((t) => new Vector3(t * 2.0 * sc * s, (zRim - 0.05 + (bailTop - zRim) * Math.sqrt(Math.max(0, 1 - t * t))) * s, 0)));
  const bail = new Mesh(mergeGeometries([nonIdx(new TubeGeometry(bailCurve, d >= 2 ? 24 : 12, 0.045 * s, d >= 1 ? 6 : 4, false)),
    nonIdx(new TorusGeometry(ringR * s, 0.03 * s, 6, 12).translate(0, (bailTop + ringR) * s, 0))].map((g) => applyWorldUV(g)), false), ctx.mats.get(COP));
  bail.name = 'altar.kiyor:bail';
  bail.castShadow = true;
  kiyor.add(bail);
  // its water
  const zW = plat + 2.72 * KH / 3;
  const water = new Mesh(applyWorldUV(new CircleGeometry(1.885 * sc * s, seg).rotateX(-Math.PI / 2).translate(0, zW * s, 0)), ctx.mats.get('water'));
  water.name = 'altar.kiyor:water';
  water.receiveShadow = true;
  kiyor.add(water);

  // ---------------------------------------------------------------- the well curb and the shaft mouth (static)
  // a dressed-stone curb round the well mouth, 3 cm proud of the pavement, in which the platform sits a hair lower
  {
    const Z0 = cz, cw = 0.3, zc = Z0 + 0.03;
    const [w0x, w0y] = wb.min, [w1x, w1y] = wb.max;
    const m = B.m('steps_stone');
    const o = [[w0x - cw, w0y - cw], [w1x + cw, w0y - cw], [w1x + cw, w1y + cw], [w0x - cw, w1y + cw]];
    const i = [[w0x, w0y], [w1x, w0y], [w1x, w1y], [w0x, w1y]];
    m.poly(o.map(([x, y]) => [x, y, zc]), [0, 0, 1], [i.map(([x, y]) => [x, y, zc])]);
    for (let e = 0; e < 4; e++) {
      const a = o[e], b = o[(e + 1) % 4], p = i[e], q = i[(e + 1) % 4];
      m.quad([a[0], a[1], Z0 - 0.05], [b[0], b[1], Z0 - 0.05], [b[0], b[1], zc], [a[0], a[1], zc]);   // outer (CCW: outward)
      m.quad([q[0], q[1], Z0 - 0.05], [p[0], p[1], Z0 - 0.05], [p[0], p[1], zc], [q[0], q[1], zc]);   // inner (facing the well)
    }
  }
  // the dark shaft mouth, shown only while the laver is down (build-courts cuts the well itself — requested); it lies under
  // the platform when the laver is up
  const shaft = new Mesh(new PlaneGeometry((wb.max[0] - wb.min[0]) * s, (wb.max[1] - wb.min[1]) * s).rotateX(-Math.PI / 2)
    .translate(cx * s, (cz + 0.012) * s, -cy * s), ctx.mats.get(A.mat('glass_dark', 'iron')));
  shaft.name = 'altar.kiyor:shaft';
  shaft.receiveShadow = true;
  A.group.add(shaft);
  // the raised laver as a static collider (the player does not walk through the bronze; at night it fences the shaft)
  {
    const g = new CylinderGeometry(2.0 * sc * s, 1.4 * sc * s, (zRim + 0.04) * s, 16).translate(cx * s, (cz + (zRim + 0.04) / 2) * s, -cy * s);
    ctx.addCollider(g, 'altar:kiyor');
  }

  // ---------------------------------------------------------------- the muchni frame (static, batched)
  const wbx = mu.params.wheel;                          // the wheel frame box south of the kiyor
  const [fx0, fy0, fz0] = wbx.min, [fx1, fy1, fz1] = wbx.max;
  const yA = (fy0 + fy1) / 2;                           // axle line
  const zA = fz0 + 2.6;                                 // axle height
  const zCap = fz1 - 0.75;                              // cap beam under the boom
  const T = 0.32;                                       // timber section (amot) ≈ 15 cm
  const M = B.m(OAK), MV = B.m(OAKV);
  const beam = (m, a, b, w, h) => beamBetween(m, a, b, w, h);
  const xT = [fx0 + 0.45, fx1 - 0.45];                  // the two trestles
  for (const x of xT) {
    beam(M, [x, fy0 + 0.05, fz0 + 0.15], [x, fy1 - 0.05, fz0 + 0.15], T, 0.3);           // sole plate
    beam(MV, [x, fy0 + 0.35, fz0 + 0.3], [x, yA - 0.12, zCap], T, T);                     // south leg
    beam(MV, [x, fy1 - 0.35, fz0 + 0.3], [x, yA + 0.12, zCap], T, T);                     // north leg
    const zt = zA - 0.45;
    const t = (zt - fz0 - 0.3) / (zCap - fz0 - 0.3);
    beam(M, [x, fy0 + 0.35 + (yA - 0.12 - fy0 - 0.35) * t, zt], [x, fy1 - 0.35 + (yA + 0.12 - fy1 + 0.35) * t, zt], T, 0.28); // tie
    M.box([x - T / 2 - 0.04, yA - 0.25, zt + 0.14], [x + T / 2 + 0.04, yA + 0.25, zA - 0.16]);                               // bearing block
  }
  beam(M, [fx0 + 0.2, yA, zCap + 0.17], [fx1 - 0.2, yA, zCap + 0.17], T, 0.34);            // cap beam
  // the boom over the kiyor, its head-sheave and two knee braces from the trestle legs
  const zBoom = zCap + 0.34 + 0.2;
  const yHead = cy - 0.24;                              // the sheave's north side hangs the rope over the kiyor's centre
  beam(M, [cx, fy0 + 0.3, zBoom], [cx, yHead + 0.55, zBoom], 0.42, 0.4);
  for (const x of xT) {
    const tl = 0.72;                                                                        // up the north leg
    const pa = [x, fy1 - 0.35 + (yA + 0.12 - fy1 + 0.35) * tl, fz0 + 0.3 + (zCap - fz0 - 0.3) * tl];
    beam(MV, pa, [cx + Math.sign(x - cx) * 0.16, cy - 1.2, zBoom - 0.2], 0.24, 0.24);
  }
  // sheave cheeks + pulley at the boom head
  M.box([cx - 0.24, yHead - 0.3, zBoom - 0.7], [cx - 0.2, yHead + 0.3, zBoom - 0.2]);
  M.box([cx + 0.2, yHead - 0.3, zBoom - 0.7], [cx + 0.24, yHead + 0.3, zBoom - 0.2]);
  const zSheave = zBoom - 0.5;
  B.geo(applyWorldUV(new CylinderGeometry(0.24 * s, 0.24 * s, 0.34 * s, 16).rotateZ(Math.PI / 2).translate(cx * s, zSheave * s, -yHead * s)), OAK, { collide: false });

  // ---------------------------------------------------------------- the windlass (movable wheel)
  const wheel = new Group();
  wheel.name = 'wheel:altar.kiyor.muchni';
  wheel.position.set(cx * s, zA * s, -yA * s);
  // the hand-wheel stands just inside the east trestle, small enough (r 1.7) that ≥ 1 amah stays clear round the
  // kohanim standing at the southern spigots
  const wr = 1.7;
  const wx = xT[1] - T / 2 - 0.25 - cx;                                // local x of the wheel's plane
  const wp = [];
  wp.push(wuv(new CylinderGeometry(0.16 * s, 0.16 * s, (fx1 - fx0 - 0.3) * s, 10).rotateZ(Math.PI / 2)));                 // axle
  wp.push(wuv(new CylinderGeometry(0.36 * s, 0.36 * s, 1.2 * s, 14).rotateZ(Math.PI / 2)));                               // rope drum
  for (const dx of [-0.62, 0.62]) wp.push(wuv(new CylinderGeometry(0.5 * s, 0.5 * s, 0.06 * s, 14).rotateZ(Math.PI / 2).translate(dx * s, 0, 0)));
  // the rim keeps the torus's own UVs in meters: the grain runs round the rim
  wp.push(nonIdx(torusUV(new TorusGeometry(wr * s, 0.13 * s, d >= 1 ? 6 : 4, d >= 2 ? 40 : 24), wr * s, 0.13 * s).rotateY(Math.PI / 2).translate(wx * s, 0, 0)));
  wp.push(wuv(new CylinderGeometry(0.3 * s, 0.3 * s, 0.4 * s, 12).rotateZ(Math.PI / 2).translate(wx * s, 0, 0)));        // hub
  const nSp = 8;
  for (let i = 0; i < nSp; i++) {
    const a = (i / nSp) * Math.PI * 2;
    const spoke = new BoxGeometry(0.12 * s, wr * s, 0.12 * s).translate(0, wr / 2 * s, 0).rotateX(a).translate(wx * s, 0, 0);
    const peg = new CylinderGeometry(0.05 * s, 0.05 * s, 0.45 * s, 6).rotateZ(Math.PI / 2).translate((wx - 0.28) * s, wr * s, 0).rotateX(a);
    wp.push(wuv(spoke), wuv(peg));
  }
  const wMesh = new Mesh(mergeGeometries(wp, false), ctx.mats.get(OAK));
  wMesh.name = 'wheel:altar.kiyor.muchni:mesh';
  wMesh.castShadow = true;
  wMesh.receiveShadow = true;
  wheel.add(wMesh);
  wheel.userData.spin = (rad) => { wheel.rotation.x = rad; };
  A.group.add(wheel);
  A.movables.set(wheel.name, wheel);

  // ---------------------------------------------------------------- ropes: drum → head-sheave (static), head → bail (moves)
  {
    const a = [cx, yA + 0.36, zA + 0.05], b = [cx, yHead - 0.05, zSheave + 0.23];
    const m = new Mesher();
    beamBetween(m, a, b, 0.07, 0.07);
    B.geo(m.geometry(), ROPE, { collide: false, cast: true });
  }
  const ropeGeo = new CylinderGeometry(0.035 * s, 0.035 * s, 1, 6).translate(0, -0.5, 0);   // unit length, hanging down from 0
  const rope = new Mesh(ropeGeo, ctx.mats.get(ROPE));
  rope.name = 'altar.kiyor:rope';
  rope.position.set(cx * s, zSheave * s, -cy * s);
  A.group.add(rope);
  const ringTop = bailTop + 2 * ringR + 0.03;          // local amot above the laver's foot
  const drop = ringTop + 0.25;                         // sunk: the whole laver, bail and ring below the pavement
  const slack = 0.7;                                   // amot of rope hanging from the sheave when the bail is unhooked
  let raised = 1;
  const apply = () => {
    const off = -(1 - raised) * drop * s;
    kiyor.position.y = cz * s + off;
    const hooked = raised < 0.999;
    bail.visible = hooked;
    shaft.visible = raised < 0.98;
    const len = hooked ? Math.max(0.05, zSheave * s - (cz * s + off + ringTop * s)) : slack * s;
    rope.scale.set(1, len, 1);
    // rope paid out from the drum turns the windlass
    wheel.rotation.x = ((1 - raised) * drop * s) / (0.36 * s);
  };
  kiyor.userData.raise = (f) => { raised = Math.min(1, Math.max(0, f)); apply(); };
  kiyor.userData.raised = () => raised;
  kiyor.userData.dropAmot = drop;
  apply();
  A.group.add(kiyor);
  A.movables.set(kiyor.name, kiyor);
}

/** a square-section beam between two site points (amot); w across (horizontal), h the other way */
export function beamBetween(m, a, b, w, h) {
  const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  const t = [ax[0] / L, ax[1] / L, ax[2] / L];
  let up = [0, 0, 1];
  if (Math.abs(t[2]) > 0.95) up = [1, 0, 0];
  let side = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
  const sl = Math.hypot(side[0], side[1], side[2]) || 1;
  side = side.map((v) => v / sl);
  const u2 = [side[1] * t[2] - side[2] * t[1], side[2] * t[0] - side[0] * t[2], side[0] * t[1] - side[1] * t[0]];
  const P = (p, sx, sy) => [p[0] + side[0] * sx * w / 2 + u2[0] * sy * h / 2, p[1] + side[1] * sx * w / 2 + u2[1] * sy * h / 2, p[2] + side[2] * sx * w / 2 + u2[2] * sy * h / 2];
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const A0 = c.map(([x, y]) => P(a, x, y)), B0 = c.map(([x, y]) => P(b, x, y));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const mid = [(A0[i][0] + A0[j][0]) / 2 - a[0], (A0[i][1] + A0[j][1]) / 2 - a[1], (A0[i][2] + A0[j][2]) / 2 - a[2]];
    m.quadH(A0[i], A0[j], B0[j], B0[i], mid);
  }
  m.quadH(A0[0], A0[1], A0[2], A0[3], t.map((v) => -v));
  m.quadH(B0[0], B0[1], B0[2], B0[3], t);
  return m;
}

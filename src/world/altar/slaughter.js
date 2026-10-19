// The slaughter zone north of the altar (Middot 3:5, 5:2; Tamid 3:5, 4:1–2; Shekalim 6:4; Rambam BhB 5:13–14; lock #18).
//
//   rings      altar.rings params.positions — 6 rows of 4 iron rings set in the pavement on hinge-staples (the animal's
//              neck was locked in them); lying folded flat ⚙ form
//   tables     altar.marble-tables params.tables — 8 marble tables (rinsing: a shallow dished top with a lip ⚙)
//   nanasin    altar.nanasin params.pillars — 8 dwarf pillars (material unstated: marble ⚙) with squared cedar blocks on
//              their heads and iron hooks fixed in them, three rows on each (Middot 3:5) — three working heights ⚙
//   flaying    altar.nanasin params.flayingStations — the 7 gaps between the pillars (anchors only; the carcass hangs on
//              the hooks beside the pillar)
import { TorusGeometry, CatmullRomCurve3, TubeGeometry, Vector3, Matrix4, BoxGeometry } from 'three';
import { sweepRing, lathe } from './lib.js';
import { roundedRectFn } from './mizbeach.js';
import { applyWorldUV, mergeGeometries } from '../geom.js';
import { AMAH } from '../../core/units.js';

const DEG = Math.PI / 180;

export function buildSlaughter(A) {
  const { el, d, B } = A;
  const MAR = 'marble_white', IRON = 'iron', CEDAR = 'cedar';
  const fs = d >= 1 ? 2 : 0;

  // ---------------------------------------------------------------- the 24 rings
  const rings = el('altar.rings').params;
  const ringR = 0.3, tube = 0.035;
  const parts = [];
  const tRing = new TorusGeometry(ringR * AMAH, tube * AMAH, d >= 2 ? 8 : 6, d >= 2 ? 28 : d >= 1 ? 20 : 14);
  tRing.rotateX(Math.PI / 2);
  const tStaple = new TorusGeometry(0.075 * AMAH, 0.03 * AMAH, 6, d >= 1 ? 10 : 6, Math.PI).rotateY(Math.PI / 2);
  const plate = new BoxGeometry(0.34 * AMAH, 0.02 * AMAH, 0.22 * AMAH);       // the leaded iron footing
  for (const [X, Y, Z] of rings.positions) {
    // ring folded flat toward the south; staple at its north edge (head south — Tamid 4:1)
    parts.push(tRing.clone().translate(X * AMAH, (Z + tube) * AMAH, -(Y - 0.05) * AMAH));
    parts.push(tStaple.clone().translate(X * AMAH, (Z + 0.012) * AMAH, -(Y + ringR - 0.05) * AMAH));
    parts.push(plate.clone().translate(X * AMAH, (Z + 0.01) * AMAH, -(Y + ringR - 0.05) * AMAH));
  }
  B.geo(applyWorldUV(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false)), IRON, { collide: false, cast: d >= 2 });

  // ---------------------------------------------------------------- the eight marble tables
  const tables = el('altar.marble-tables').params.tables;
  const mm = (k) => B.m(k);
  for (const t of tables) {
    const z1 = t.max[2], zt0 = z1 - 0.3;
    // the slab: arrised edge, a lip of a tefach round a shallow dished top for rinsing (Rambam BhB 5:14) ⚙
    const P = [[0, zt0], [0, z1 - 0.05]];
    if (fs) for (let i = 1; i <= fs; i++) { const a = (90 * i) / fs * DEG; P.push([-0.05 + 0.05 * Math.cos(a), z1 - 0.05 + 0.05 * Math.sin(a)]); }
    else P.push([0, z1]);
    if (d >= 1) P.push([-0.15, z1], [-0.19, z1 - 0.04], [-0.3, z1 - 0.055]);
    sweepRing(mm, roundedRectFn(t.min[0], t.min[1], t.max[0], t.max[1], (o) => 0.06 + o, fs ? 2 : 0), P, { mat: MAR, cap: true, capBottom: true, smoothProf: 60 });
    // two end slabs (trestles) with a foot
    // two marble supports set well in from the ends, so the slab overhangs like a table ⚙
    for (const xx of [t.min[0] + 0.5, t.max[0] - 0.8]) {
      sweepRing(mm, roundedRectFn(xx, t.min[1] + 0.32, xx + 0.3, t.max[1] - 0.32, (o) => 0.03 + o, fs ? 1 : 0),
        [[0.08, t.min[2]], [0.08, t.min[2] + 0.1], [0, t.min[2] + 0.18], [0, zt0 - 0.12], [0.05, zt0 - 0.05], [0.05, zt0]], { mat: MAR });
    }
  }

  // ---------------------------------------------------------------- the eight nanasin
  const nn = el('altar.nanasin').params;
  const shaftH = nn.shaftH, sec = nn.section;
  const capW = sec * 1.3, capH = el('altar.nanasin').box.max[2] - nn.pillars[0][2] - shaftH;
  const segs = [10, 16, 24, 32][d];
  const plinthH = 0.25;
  const rB = sec / 2;
  const shaftProf = d >= 1
    ? [[rB + 0.1, plinthH], [rB + 0.12, plinthH + 0.04], [rB + 0.1, plinthH + 0.1], [rB + 0.03, plinthH + 0.14], [rB, plinthH + 0.2],
      [rB * 0.94, shaftH - 0.22], [rB * 0.98, shaftH - 0.17], [rB * 1.06, shaftH - 0.1], [rB * 1.06, shaftH], [0, shaftH]]
    : [[rB + 0.08, plinthH], [rB, plinthH + 0.12], [rB * 0.94, shaftH], [0, shaftH]];
  /** shaft radius at height h above its foot (the lathe profile, interpolated) */
  const shaftR = (h) => {
    for (let i = 1; i < shaftProf.length; i++) {
      const [ra, za] = shaftProf[i - 1], [rb, zb] = shaftProf[i];
      if (h <= zb && zb > za) return ra + ((rb - ra) * (h - za)) / (zb - za);
    }
    return rB;
  };
  const REACH = 4.2;                                     // amot over the pavement a standing kohen hangs at (≈ 2 m) ⚙
  const shafts = [];
  const hooks = [];
  // one hook (local meters): out of the face along +x, turned up to a point
  const hookGeo = (() => {
    const s = AMAH;
    if (d === 0) {
      const a = new BoxGeometry(0.2 * s, 0.03 * s, 0.03 * s).translate(0.1 * s, 0, 0);
      const b = new BoxGeometry(0.03 * s, 0.12 * s, 0.03 * s).translate(0.2 * s, 0.06 * s, 0);
      return mergeGeometries([a.toNonIndexed(), b.toNonIndexed()], false);
    }
    const c = new CatmullRomCurve3([new Vector3(-0.02 * s, 0, 0), new Vector3(0.12 * s, 0, 0), new Vector3(0.2 * s, 0.02 * s, 0),
      new Vector3(0.23 * s, 0.08 * s, 0), new Vector3(0.22 * s, 0.15 * s, 0)]);
    return new TubeGeometry(c, d >= 2 ? 10 : 7, 0.018 * s, d >= 2 ? 6 : 4, false).toNonIndexed();
  })();
  const mtx = new Matrix4(), rot = new Matrix4();
  for (const [X, Y, Z] of nn.pillars) {
    // plinth
    sweepRing(mm, roundedRectFn(X - 0.65, Y - 0.65, X + 0.65, Y + 0.65, (o) => 0.04 + o, fs ? 1 : 0),
      [[0, Z], [0, Z + plinthH - 0.04], [-0.04, Z + plinthH]], { mat: MAR, cap: true });
    shafts.push(lathe(shaftProf, [X, Y, Z], segs).toNonIndexed());
    // the squared cedar block (revi'in shel erez), closed underneath by its own ring (no slit of sky along its foot)
    const z0 = Z + shaftH, z1 = z0 + capH;
    const CP = [[0, z0], [0, z1 - 0.05], [-0.05, z1]];
    sweepRing(mm, roundedRectFn(X - capW / 2, Y - capW / 2, X + capW / 2, Y + capW / 2, (o) => 0.05 + o, fs ? 1 : 0), CP, { mat: CEDAR, cap: true, capBottom: true });
    // iron hooks, three rows on each (Middot 3:5; Tamid 3:5), each row two toward the flaying gaps (E, W) and one on N
    // and S ⚙. The rows are three working heights: the lamb is hung by a hind leg pierced at the hock and flayed
    // downward (Tamid 4:2), so its hook must be within a standing kohen's reach (≈ 2 m). While the cedar block is
    // within reach all three rows are in it; with site.js's tall shafts (NANAS_H ⚙) only the top row (the heavy
    // carcasses) is in the block and the other two are leaded into the shaft below it.
    const blockMid = z0 + capH * 0.5 - Z <= REACH;
    const rowsBlock = blockMid ? [z0 + capH * 0.2, z0 + capH * 0.5, z0 + capH * 0.8] : [z0 + capH * 0.45];
    const rowsShaft = blockMid ? [] : [Z + REACH - 0.2, Z + REACH - 0.9];
    const place = (px, py, z, yaw) => {        // makeRotationY(θ)·(1,0,0) = (cos θ, 0, −sin θ) = world of site (cos θ, sin θ)
      rot.makeRotationY(yaw);
      mtx.makeTranslation(px * AMAH, z * AMAH, -py * AMAH).multiply(rot);
      hooks.push(hookGeo.clone().applyMatrix4(mtx));
    };
    for (const [nx, ny, per] of [[1, 0, 2], [-1, 0, 2], [0, 1, 1], [0, -1, 1]]) {
      const yaw = Math.atan2(ny, nx);
      for (const z of rowsBlock) for (let k = 0; k < per; k++) {
        const off = per === 1 ? 0 : (k === 0 ? -0.3 : 0.3);
        place(X + nx * capW / 2 + (ny !== 0 ? off : 0), Y + ny * capW / 2 + (nx !== 0 ? off : 0), z, yaw);
      }
    }
    for (const z of rowsShaft) {
      const rr = shaftR(z - Z);
      for (const az of [-30, 30, 150, 210, 90, 270]) { const a = az * DEG; place(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, z, a); }
    }
  }
  B.geo(mergeGeometries(shafts, false), MAR, { collide: true, cast: true });
  B.geo(applyWorldUV(mergeGeometries(hooks, false)), IRON, { collide: false, cast: d >= 2 });
}

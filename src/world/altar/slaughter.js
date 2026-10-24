// The slaughter zone north of the altar (Middot 3:5, 5:2; Tamid 3:5, 4:1–2; Shekalim 6:4; Rambam BhB 5:13–14; lock #18).
//
//   rings      altar.rings params.positions — 6 rows of 4 iron rings set in the pavement on hinge-staples (the animal's
//              neck was locked in them); lying folded flat ⚙ form
//   tables     altar.marble-tables params.tables — 8 marble tables (rinsing: a shallow dished top with a lip ⚙)
//   nanasin    altar.nanasin params.pillars — 8 dwarf pillars (material unstated: marble ⚙): shaft params.shaftH with a
//              squared cedar block params.capH on its head (top params.topZ), the iron hooks fixed in the block in three
//              rows one above another (Middot 3:5; params.hookRowsZ) — low for a lamb, middle for a ram, high for a bull
//   flaying    altar.nanasin params.flayingStations — the 7 gaps between the pillars (anchors only; the carcass hangs on
//              the hooks beside the pillar)
import { TorusGeometry, CatmullRomCurve3, TubeGeometry, Vector3, Matrix4, BoxGeometry } from 'three';
import { sweepRing, lathe } from './lib.js';
import { roundedRectFn } from './mizbeach.js';
import { applyWorldUV, mergeGeometries } from '../geom.js';
import { AMAH } from '../../core/units.js';

const DEG = Math.PI / 180;
/** a hook's crook (where a pierced hock rests): [out of the block's face, above the hook's root], amot */
const HOOK_CROOK = [0.2, 0.02];

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
  // Bilgah's ring, "fixed" (Sukkah 5:8; 56b): "the rings were turned up to take the neck and turned back down into the
  // floor; Bilgah's is fixed and does not turn" (Rashi 56a). It lies folded down like the others, and lead is run over
  // its staple and over its far arc onto a second footing plate, so it can never be raised ⚙ (site.js altar.rings
  // params.bilgah: which ring is the 15th mishmar's)
  const bil = rings.bilgah;
  if (bil?.ring) {
    const [X, Y, Z] = bil.ring;
    const lead = [];
    parts.push(plate.clone().translate(X * AMAH, (Z + 0.01) * AMAH, -(Y - ringR - 0.05) * AMAH));
    // a puddle of lead: a low, flattened cap, stretched along the ring's arc (local metres, centre on the floor)
    const puddle = (cx, cy, rx, ry, h) => {
      const g = lathe([[0, 0], [1, 0], [0.97, 0.25], [0.82, 0.62], [0.55, 0.88], [0.25, 0.98], [0, 1]], [0, 0, 0], d >= 2 ? 14 : 10);
      g.scale(rx, h, ry);
      g.translate(cx * AMAH, (Z + 0.004) * AMAH, -cy * AMAH);
      return g;
    };
    // (the ring's tube stands 0.07 over the floor: each run buries its arc and slopes off to the plate's edges)
    lead.push(puddle(X, Y + ringR - 0.05, 0.19, 0.14, 0.11));          // over the staple: the hinge run fast
    lead.push(puddle(X, Y - ringR - 0.05, 0.17, 0.12, 0.1));           // over the far arc, onto its own plate
    B.geo(applyWorldUV(mergeGeometries(lead.map((g) => (g.index ? g.toNonIndexed() : g)), false)), A.mat('lead', IRON), { collide: false, cast: false });
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
  // "dwarf" pillars: shaft params.shaftH + squared cedar block params.capH = params.topZ (site-model-2: 3 + 1 = 4 amot),
  // the three rows of hooks at params.hookRowsZ, all in the cedar ("in stone the hooks cannot be fixed", EK II 51)
  const nn = el('altar.nanasin').params;
  const shaftH = nn.shaftH, capH = nn.capH, sec = nn.section;
  const capW = sec * 1.3;
  const segs = [10, 16, 24, 32][d];
  const plinthH = 0.25;
  const rB = sec / 2;
  const shaftProf = d >= 1
    ? [[rB + 0.1, plinthH], [rB + 0.12, plinthH + 0.04], [rB + 0.1, plinthH + 0.1], [rB + 0.03, plinthH + 0.14], [rB, plinthH + 0.2],
      [rB * 0.94, shaftH - 0.22], [rB * 0.98, shaftH - 0.17], [rB * 1.06, shaftH - 0.1], [rB * 1.06, shaftH], [0, shaftH]]
    : [[rB + 0.08, plinthH], [rB, plinthH + 0.12], [rB * 0.94, shaftH], [0, shaftH]];
  const shafts = [];
  /** where a carcass hangs from each pillar's south-face hook, per row (the side facing the tables — Rash, Bartenura on
   *  Middot 3:5): read by the anchors (index.js 'altar.hook.<pillar>.<row>') */
  A.hookPoints = [];
  const hooks = [];
  // one hook (local meters): out of the face along +x, turned up to a point
  const hookGeo = (() => {
    const s = AMAH;
    if (d === 0) {
      const a = new BoxGeometry(0.2 * s, 0.03 * s, 0.03 * s).translate(0.1 * s, 0, 0);
      const b = new BoxGeometry(0.03 * s, 0.12 * s, 0.03 * s).translate(0.2 * s, 0.06 * s, 0);
      return mergeGeometries([a.toNonIndexed(), b.toNonIndexed()], false);
    }
    // qa-r2-fix-world: a forged hook heavy enough to carry a bull (≈ 1.5 cm bar, was 0.9 — it read as a crack in the
    // wood), its root under a square iron plate nailed to the block ⚙
    const c = new CatmullRomCurve3([new Vector3(-0.02 * s, 0, 0), new Vector3(0.12 * s, 0, 0), new Vector3(HOOK_CROOK[0] * s, HOOK_CROOK[1] * s, 0),
      new Vector3(0.24 * s, 0.09 * s, 0), new Vector3(0.225 * s, 0.17 * s, 0)]);
    const bar = new TubeGeometry(c, d >= 2 ? 12 : 8, 0.032 * s, d >= 2 ? 6 : 4, false).toNonIndexed();
    const plate = new BoxGeometry(0.025 * s, 0.13 * s, 0.13 * s).translate(0.0125 * s, 0, 0).toNonIndexed();
    for (const k of Object.keys(plate.attributes)) if (!bar.attributes[k]) plate.deleteAttribute(k);
    return mergeGeometries([bar, plate], false);
  })();
  const mtx = new Matrix4(), rot = new Matrix4();
  const ENDK = A.mat('cedar_end', 'cedar_v');
  /** the cedar block: an (optionally chamfered) square prism, half-width h, from z0 to z1; E/W faces end grain */
  const cedarBlock = (X, Y, z0, z1, h, ch) => {
    const side = B.m(CEDAR), end = B.m(ENDK);
    const x0 = X - h, x1 = X + h, y0 = Y - h, y1 = Y + h;
    // the plan outline counter-clockwise seen from above, its corners chamfered
    const P = ch > 0
      ? [[x0 + ch, y0], [x1 - ch, y0], [x1, y0 + ch], [x1, y1 - ch], [x1 - ch, y1], [x0 + ch, y1], [x0, y1 - ch], [x0, y0 + ch]]
      : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const nx = b[1] - a[1], ny = -(b[0] - a[0]);                  // outward normal of a counter-clockwise edge
      const isEnd = Math.abs(nx) > 0.99 * Math.hypot(nx, ny);       // an east or west face: the end grain
      (isEnd ? end : side).quadH([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], [nx, ny, 0]);
    }
    side.poly(P.map(([x, y]) => [x, y, z1]), [0, 0, 1]);
    side.poly(P.map(([x, y]) => [x, y, z0]), [0, 0, -1]);
  };
  for (const [X, Y, Z] of nn.pillars) {
    // plinth
    sweepRing(mm, roundedRectFn(X - 0.65, Y - 0.65, X + 0.65, Y + 0.65, (o) => 0.04 + o, fs ? 1 : 0),
      [[0, Z], [0, Z + plinthH - 0.04], [-0.04, Z + plinthH]], { mat: MAR, cap: true });
    shafts.push(lathe(shaftProf, [X, Y, Z], segs).toNonIndexed());
    // the squared cedar block (revi'in shel erez), closed underneath (no slit of sky along its foot). qa-r2-fix-world:
    // a timber, not a wrapped box ⚙ — its grain runs east–west along the row, so its north and south faces and its top
    // are long grain and its east and west faces end grain (materials' cedar_end once it exists, else the grain turned
    // across the face), its vertical arrises chamfered
    cedarBlock(X, Y, Z + shaftH, nn.topZ, capW / 2, d >= 1 ? 0.06 : 0);
    // iron hooks, three rows in the block (Middot 3:5; Tamid 3:5) at site.js's hookRowsZ, one above another — low for a
    // lamb, middle for a ram, high for a bull (Rash, Bartenura; EK II 58) — each row two toward the flaying gaps (E, W)
    // and one on N and S ⚙. All three rows are within a standing kohen's reach (+3.2 … +3.8 ≈ 1.5–1.8 m), where the
    // lamb is hung by a hind leg pierced at the hock (Tamid 4:2).
    const place = (px, py, z, yaw) => {        // makeRotationY(θ)·(1,0,0) = (cos θ, 0, −sin θ) = world of site (cos θ, sin θ)
      rot.makeRotationY(yaw);
      mtx.makeTranslation(px * AMAH, z * AMAH, -py * AMAH).multiply(rot);
      hooks.push(hookGeo.clone().applyMatrix4(mtx));
    };
    for (const [nx, ny, per] of [[1, 0, 2], [-1, 0, 2], [0, 1, 1], [0, -1, 1]]) {
      const yaw = Math.atan2(ny, nx);
      for (const z of nn.hookRowsZ) for (let k = 0; k < per; k++) {
        const off = per === 1 ? 0 : (k === 0 ? -0.3 : 0.3);
        place(X + nx * capW / 2 + (ny !== 0 ? off : 0), Y + ny * capW / 2 + (nx !== 0 ? off : 0), z, yaw);
      }
    }
    // the crook of the south hook (0.2 out of the face, 0.02 above its root) — where the pierced hock rests
    A.hookPoints.push(nn.hookRowsZ.map((z) => [X, Y - capW / 2 - HOOK_CROOK[0], z + HOOK_CROOK[1]]));
  }
  B.geo(mergeGeometries(shafts, false), MAR, { collide: true, cast: true });
  B.geo(applyWorldUV(mergeGeometries(hooks, false)), IRON, { collide: false, cast: d >= 2 });
}

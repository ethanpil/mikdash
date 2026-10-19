// The Kodesh and the Kodesh HaKodashim: the coffered kiyur ceiling (lock #40) and the gold cornice (the walls' gold
// relief lining itself is dressed on the shell's faces — shell.js / uv.js), the vessels (vessels.js), the sotah slab
// (Sotah 2:2), the two parochot one amah apart — the outer pinned back at its south end, the inner at its north (Yoma
// 51b–52b; locks #5, #42) — the two curtains above them in the aliyah and the lul's small curtain, the Even Shetiyah
// (Yoma 5:2), and the aliyah's rashei pispasin and lulin (Middot 4:5). Registers the Menorah's seven lamps as fires
// and as movables.
import { TorusGeometry, Object3D } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { applyWorldUV } from '../geom.js';
import { B, Mesher, gridSolid, sweep, lathe, tube } from './lib/geo.js';
import { Drape } from './lib/kit.js';
import { buildMenorah, buildShulchan, buildGoldenAltar } from './vessels.js';

const TF = 1 / 6;

export function buildKodesh(H) {
  const { d } = H;
  if (d >= 1) { ceiling(H); cornice(H); }
  const men = buildMenorah(H);
  buildShulchan(H);
  buildGoldenAltar(H);
  sotahSlab(H);
  parochot(H);
  evenShetiyah(H);
  aliyah(H);
  lamps(H, men);
}

/** the kiyur as a coffered ceiling: 3-amah coffers on a 4-amah grid (aligned with the relief modules), two steps
 *  deep, an open flower in each at higher detail; the KhK's central coffer opens into the lulin shaft ⚙ */
function ceiling(H) {
  const { kit, el, d } = H;
  const kod = H.rooms.kodesh, khk = H.rooms.khk;
  const z = kod.max[2], zt = el('heichal.ceiling.kiyur').box.max[2];
  const adds = [B(khk.min[0], khk.min[1], z, kod.max[0], kod.max[1], zt)];
  const subs = [];
  const lul = el('heichal.aliyah').params.lulin[0];
  subs.push(B(lul.min[0], lul.min[1], z - 0.1, lul.max[0], lul.max[1], zt + 0.1, { lulin: true }));
  const centres = [];
  for (const room of [khk, kod]) {
    const nx = Math.round((room.max[0] - room.min[0]) / 4), ny = Math.round((room.max[1] - room.min[1]) / 4);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x0 = room.min[0] + 4 * i, y0 = room.min[1] + 4 * j;
      subs.push(B(x0 + 0.5, y0 + 0.5, z - 0.1, x0 + 3.5, y0 + 3.5, z + 0.35, { coffer: true }));
      subs.push(B(x0 + 0.85, y0 + 0.85, z - 0.1, x0 + 3.15, y0 + 3.15, z + 0.7, { coffer: true }));
      centres.push([x0 + 2, y0 + 2]);
    }
  }
  const map = gridSolid(adds, subs, (f) => {
    if (f.axis === 2 && f.dir < 0) return 'gold_plate';
    if (f.sub) return f.sub.lulin ? 'ashlar_plain' : 'gold_plate';
    return null;
  });
  kit.solid(map, false, false);
  if (d >= 2) {
    const seg = d >= 3 ? 16 : 10;
    for (const [x, y] of centres) {
      if (x > lul.min[0] && x < lul.max[0] && y > lul.min[1] && y < lul.max[1]) continue;
      // an open flower hanging from the coffer's floor (1 Melachim 6:29 "p'turei tzitzim") ⚙
      const g = lathe([[0, 0], [0.42, 0], [0.5, -0.05], [0.36, -0.14], [0.2, -0.12], [0.12, -0.22], [0, -0.24]], [x, y, z + 0.7], seg);
      kit.geo(g, 'gold_vessel', { collide: false, castShadow: false });
    }
  }
}

/** a gold cavetto cornice where the walls meet the kiyur (+61 → +62), broken at the amah traksin for the parochot */
function cornice(H) {
  const { kit } = H;
  const kod = H.rooms.kodesh, khk = H.rooms.khk;
  const z0 = kod.max[2] - 1;
  const prof = [[0, 0], [0.06, 0], [0.06, 0.12], [0.1, 0.18], [0.16, 0.42], [0.28, 0.72], [0.36, 0.78], [0.36, 1], [0, 1]];
  const m = kit.m('gold_plate', false, false);
  const e = 0.36;
  // Kodesh: N, S and E walls; KhK: N, S and W walls
  sweep(m, prof, [kod.min[0], kod.max[1]], [kod.max[0] + e * 0, kod.max[1]], z0, [0, -1]);
  sweep(m, prof, [kod.max[0], kod.min[1]], [kod.min[0], kod.min[1]], z0, [0, 1]);
  sweep(m, prof, [kod.max[0], kod.max[1]], [kod.max[0], kod.min[1]], z0, [-1, 0]);
  sweep(m, prof, [khk.min[0], khk.max[1]], [khk.max[0], khk.max[1]], z0, [0, -1]);
  sweep(m, prof, [khk.max[0], khk.min[1]], [khk.min[0], khk.min[1]], z0, [0, 1]);
  sweep(m, prof, [khk.min[0], khk.min[1]], [khk.min[0], khk.max[1]], z0, [1, 0]);
}

/** the sotah slab: an amah-square marble tablet with a fixed ring, just within the gate on the north (Sotah 2:2) */
function sotahSlab(H) {
  const { kit, el } = H;
  const b = el('heichal.sotah-slab').box;
  const m = kit.m('marble_white', true, true);
  m.box([b.min[0], b.min[1], b.min[2]], [b.max[0], b.max[1], b.max[2]], 'xXyYZ');
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
  const g = new TorusGeometry(0.11 * AMAH, 0.018 * AMAH, 6, 18);
  g.rotateX(Math.PI / 2);
  g.translate(...m2w(cx, cy, b.max[2] + 0.02).toArray());
  applyWorldUV(g);
  kit.geo(g, 'iron', { collide: false, castShadow: false });
  const s = new Mesher();
  s.box([cx - 0.14, cy - 0.03, b.max[2]], [cx - 0.09, cy + 0.03, b.max[2] + 0.04]);
  kit.geo(s.geometry(), 'iron', { collide: false, castShadow: false });
}

/** the two parochot of the amah traksin, the two above them in the aliyah, and the lul's small curtain */
function parochot(H) {
  const { kit, el } = H;
  const outer = el('heichal.parochet.outer'), inner = el('heichal.parochet.inner');
  const T = outer.params.thickness;
  const zTop = H.rooms.kodesh.max[2] - 0.12;
  const mk = (e, fixedAt, seed) => {
    const b = e.box, x = (b.min[0] + b.max[0]) / 2;
    const a = fixedAt === 'north' ? [x, b.max[1]] : [x, b.min[1]];
    const bb = fixedAt === 'north' ? [x, b.min[1]] : [x, b.max[1]];
    const dr = new Drape(kit, { id: e.id, a, b: bb, z0: b.min[2], z1: zTop, t: T, fold: 1.6, amp: 0.085, gather: 0.16, endPortion: 0.22, mode: 'pinned', seed });
    // default: drawn back about 2 amot at the pinned end (the KG's way in — Yoma 52b)
    const f = 2 / (dr.spec.endPortion * dr.W * (1 - dr.spec.gather));
    dr.register(e.id, { open: f, label: e.name.en, extra: { pinnedBack: e.params.pinnedBack, fixedEnd: fixedAt, defaultOpen: f } });
    kit.geo(tube([x, b.min[1], zTop + 0.06], [x, b.max[1], zTop + 0.06], 0.05, 8, true), 'gold_vessel', { collide: false });
  };
  mk(outer, 'north', 11);     // outer: pinned back at its SOUTH end → fixed at the north
  mk(inner, 'south', 13);     // inner: pinned back at its NORTH end → fixed at the south
  // the aliyah's two curtains on the same line (Yoma 54a): hanging closed — baked into the batch
  for (const [i, c] of el('heichal.aliyah').params.curtains.entries()) {
    const x = (c.min[0] + c.max[0]) / 2;
    const dr = new Drape(kit, { id: `aliyah-${i}`, a: [x, c.min[1]], b: [x, c.max[1]], z0: c.min[2], z1: c.max[2] - 0.12, t: T, fold: 1.6, amp: 0.08, mode: 'pinned', seed: 21 + i });
    dr.update(0);
    kit.geo(dr.geometry.toNonIndexed(), 'parochet', { collide: false, castShadow: true });
    kit.geo(tube([x, c.min[1], c.max[2] - 0.06], [x, c.max[1], c.max[2] - 0.06], 0.05, 6, true), 'gold_vessel', { collide: false });
  }
  // the lul's small curtain at the KhK face (Zevachim 55b; site params.smallCurtain)
  const lul = el('heichal.lul-west').box;
  // hung close to the wall and lapping the jambs and head well, so no daylight shows round its edges
  const xl = lul.max[0] + 0.09;
  const dl = new Drape(kit, { id: 'lul', a: [xl, lul.min[1] - 0.45], b: [xl, lul.max[1] + 0.45], z0: lul.min[2], z1: lul.max[2] + 0.35, t: 0.08, fold: 0.4, amp: 0.035, mode: 'pinned', seed: 31 });
  dl.update(0);
  kit.geo(dl.geometry.toNonIndexed(), 'parochet', { collide: false, castShadow: false });
}

/** the Even Shetiyah: bare bedrock rising three etzba'ot above the floor, in the west of the KhK (Yoma 5:2) */
function evenShetiyah(H) {
  const { kit, el, d } = H;
  const e = el('heichal.even-shetiyah');
  const b = e.box, hMax = e.params.height;
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
  const rx = (b.max[0] - b.min[0]) / 2, ry = (b.max[1] - b.min[1]) / 2;
  const n = [14, 22, 34, 46][d];
  let s = 977;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const lobes = Array.from({ length: 5 }, () => [rnd() * Math.PI * 2, 0.08 + rnd() * 0.12, 2 + Math.floor(rnd() * 4)]);
  const bumps = Array.from({ length: 11 }, () => [cx + (rnd() - 0.5) * rx * 1.4, cy + (rnd() - 0.5) * ry * 1.4, 0.15 + rnd() * 0.4, (rnd() - 0.45) * 0.4]);
  const edgeAt = (a) => { let e = 1; for (const [ph, amp, k] of lobes) e += amp * Math.sin(k * a + ph) + 0.03 * Math.sin(17 * a + ph); return Math.max(0.6, e); };
  // a broken, roughly level top (the rock's own surface, worn) and a crisp margin: the rock breaks through the
  // plating within a few etzba'ot ⚙
  const hAt = (x, y) => {
    const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
    const rho = Math.hypot((x - cx) / rx, (y - cy) / ry) / edgeAt(a);
    let top = hMax * 0.78;
    for (const [bx, by, br, ba] of bumps) top += hMax * ba * Math.exp(-(((x - bx) ** 2 + (y - by) ** 2) / (br * br)));
    top = Math.min(hMax, Math.max(hMax * 0.35, top));
    const k = Math.min(1, Math.max(0, (rho - 0.86) / 0.12));
    const s = k * k * (3 - 2 * k);
    return Math.max(-0.06, top * (1 - s) - hMax * 0.6 * s);
  };
  const m = kit.m('bedrock', true, true);
  const x0 = b.min[0] - 0.25, x1 = b.max[0] + 0.25, y0 = b.min[1] - 0.25, y1 = b.max[1] + 0.25;
  const P = (i, j) => { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * j) / n; return [x, y, b.min[2] + hAt(x, y)]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = P(i, j), bb = P(i + 1, j), c = P(i + 1, j + 1), dd = P(i, j + 1);
    if (Math.max(a[2], bb[2], c[2], dd[2]) < b.min[2] - 0.001) continue;
    m.quadH(a, bb, c, dd, [0, 0, 1]);
  }
  // the plating's edge turned up against the rock: a thin gold lip following the line where it meets the floor
  if (d >= 1) {
    const g = kit.m('gold_plate', false, false);
    const N = [0, 40, 64, 80][d];
    const ring = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      let r = 1.1;
      for (let s = 0.8; s <= 1.1; s += 0.005) { const e = edgeAt(a) * s; if (hAt(cx + rx * e * Math.cos(a), cy + ry * e * Math.sin(a)) <= 0.004) { r = s; break; } }
      const e = edgeAt(a) * r;
      ring.push([cx + rx * e * Math.cos(a), cy + ry * e * Math.sin(a)]);
    }
    const lw = 0.035, lh = 0.03;
    for (let k = 0; k < N; k++) {
      const p = ring[k], q = ring[(k + 1) % N];
      const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
      const ex = (dx / L) * 0.004, ey = (dy / L) * 0.004;
      g.beam([p[0] - ex, p[1] - ey, b.min[2] + lh / 2], [q[0] + ex, q[1] + ey, b.min[2] + lh / 2], lw, lh, [0, 0, 1], false);
    }
  }
}

/** aliyah: the rashei pispasin dividing the space over the Kodesh from that over the KhK, and the lulin hatch cover */
function aliyah(H) {
  const { kit, el } = H;
  const p = el('heichal.aliyah').params;
  const rp = p.rasheiPispasin;
  const m = kit.m('marble_white', false, true);
  const n = Math.round(rp.max[1] - rp.min[1]);
  for (let i = 0; i < n; i++) {
    const y = rp.min[1] + i + 0.5;
    m.box([rp.min[0] + 0.25, y - 0.25, rp.min[2]], [rp.max[0] - 0.25, y + 0.25, rp.max[2]], 'xXyYZ');
  }
  const l = p.lulin[0];
  const c = kit.m('cedar', true, true);
  c.box([l.min[0] - 0.1, l.min[1] - 0.1, l.max[2] - 0.15], [l.max[0] + 0.1, l.max[1] + 0.1, l.max[2] + 0.04]);
  c.box([l.min[0] + 0.3, l.min[1] + 0.9, l.max[2] + 0.04], [l.max[0] - 0.3, l.min[1] + 1.1, l.max[2] + 0.12]);
}

/** the Menorah's seven lamps: fires (the sim decides which burn) + movables 'heichal.menorah.lamp-<i>' (east → west) */
function lamps(H, men) {
  const { ctx, kit } = H;
  // Lamps run east–west (lock #11, Raavad from Tamid 3:9 / 6:1): "he found the two eastern lamps burning, cleaned
  // the eastern and left the western burning" — so the ner ma'aravi is the second lamp from the east ⚙ (site.js notes
  // the Rambam's centre lamp; see the decisions log). It stays lit by day; the others burn from evening to morning.
  const nerMaaravi = 1;
  const size = 0.075;
  men.flames.forEach((p, i) => {
    const id = `heichal.menorah.lamp-${i}`;
    ctx.addFire({ id, kind: 'lamp', pos: p, size, intensity: 1, schedule: i === nerMaaravi ? 'always' : 'night' });
    const node = new Object3D();
    node.name = id;
    node.position.copy(m2w(p[0], p[1], p[2]));
    node.userData = {
      kind: 'lamp', fireId: id, index: i, nerMaaravi: i === nerMaaravi, order: 'east→west',
      setLit(v) { ctx.fx?.setFire?.(id, v); return v; },
    };
    kit.add(node);
    ctx.movables.set(id, node);
  });
  H.menorah = men;
}

export { TF };

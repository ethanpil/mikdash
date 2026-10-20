// World builder: the Mizbeach and its service zone (ARCHITECTURE.md §5; report Part IV; locks #2–#4, #17–#19, #25, #29).
//
// Every position and dimension comes from src/data/site.js (ctx.el); the research gives form and material;
// reconstruction choices are logged in docs/decisions/build-altar.md.
//
//   lib.js        site-frame Mesher, material buckets, profile sweeps round rounded rects / polygons, lathes, logs, fields
//   mizbeach.js   yesod, body, chut hasikra, karkov (the band under the sovev; the walkway on top), sovev, keranot, shitin,
//                 libation cups, shit slab
//   fire.js       the ash floor, the tapuach, the three ma'arachot (gizrin of a shortened amah) and their fires (fx 'pyre'),
//                 the two Moshe-standard gizrin
//   kevesh.js     the kevesh (ground piece + flying span), the two small ramps, the revuvah, the marble and silver tables,
//                 the silver machtah, Beit HaDeshen
//   slaughter.js  the 24 rings, the 8 marble tables, the 8 nanasin with cedar blocks and iron hooks
//   kiyor.js      the kiyor with 12 spigots on its sinking platform in a stone well curb, Ben Katin's muchni (windlass + boom)
//   ulam.js       the twelve steps of the Ulam
//   water.js      running water in the amah's open runs, culvert mouths
//   kitchen.js    the kohanim's cooking place at offerings.js STATIONS.kitchen: hearth stones, a copper cauldron and
//                 griddle, the scouring basin, firewood (reconstruction)
//
// Static parts go through one StaticBatcher (one draw call per material). Movables (ctx.movables):
//   'altar.kiyor'               userData.raise(f) — 1 up (in use), 0 sunk in its well overnight; turns the wheel too
//   'wheel:altar.kiyor.muchni'  userData.spin(rad) about the E–W axle
//   'altar.libation-cups', 'altar.libation-cup.water', 'altar.libation-cup.wine'   the silver cups at the SW horn
//   'altar.machtah'             the silver fire-pan in its niche (Tamid 1:4)
//   'altar.two-logs'            the two gizrin laid on the great pile (toggle .visible)
//   'altar.maarachah.great.pile'  userData.build(f) — 0 cleared to its ember bed … 1 the built (burning) pile; open(f) alias
//   'altar.tapuach'             userData.grow(f) — 1 site.js's mound … 0 a low remnant (the great pile's rows follow it);
//                               open(f) alias; heightAt(X, Y) the visible mound's site Z (colliders stay the full mound)
// Fires: 'altar.maarachah.great' | '.incense' | '.kiyum' (kind 'pyre', smoke, always); 'altar.kitchen.fire' (hearth) and
// 'altar.beit-hadeshen.fire' (small pyre, smoke) — schedule 'service', intensity 0: the sim lights them (fx.setFire).
// Anchors: 'altar.*' and 'station.<offerings.js STATIONS id>' (see registerAnchors).
import { Group } from 'three';
import { StaticBatcher } from '../geom.js';
import { AMAH } from '../../core/units.js';
import { Buckets } from './lib.js';
import { buildMizbeach } from './mizbeach.js';
import { buildFire } from './fire.js';
import { buildKevesh } from './kevesh.js';
import { buildSlaughter } from './slaughter.js';
import { buildKiyor } from './kiyor.js';
import { buildUlamSteps } from './ulam.js';
import { buildWater } from './water.js';
import { buildKitchen } from './kitchen.js';
import { STATIONS } from '../../data/offerings.js';

export async function build(ctx) {
  const t0 = performance.now();
  const group = new Group();
  group.name = 'altar';
  const B = new Buckets();
  const A = {
    ctx, B, group, AMAH,
    d: Math.max(0, Math.min(3, ctx.quality?.detail ?? 1)),
    el: (id) => ctx.el(id),
    movables: ctx.movables,
    fires: [],
    seed: (ctx.params?.seed ?? 5786) | 0,
    /** "a hair's breadth" of air between the kevesh (and its small ramps) and the altar — Zevachim 62b; 1 cm ⚙ */
    HAIR: 0.02,
    /** material key with a fallback while the materials task has not added it */
    mat: (key, fallback) => (ctx.mats?.has?.(key) ? key : fallback),
  };
  const steps = [
    ['mizbeach', buildMizbeach], ['fire', buildFire], ['kevesh', buildKevesh], ['slaughter', buildSlaughter],
    ['kiyor', buildKiyor], ['ulam-steps', buildUlamSteps], ['water', buildWater], ['kitchen', buildKitchen],
  ];
  const info = {};
  for (const [name, fn] of steps) {
    try {
      info[name] = fn(A) || true;
    } catch (e) {
      console.error(`[altar] ${name} failed`, e);
      ctx.bus?.emit?.('build:error', { name: `altar/${name}`, error: e });
    }
  }
  const batcher = new StaticBatcher(ctx, 'altar');
  B.flush(batcher);
  const stat = batcher.build();
  stat.name = 'altar:static';
  group.add(stat);
  registerAnchors(A);
  group.userData.stats = stats(group);
  group.userData.buildMs = Math.round(performance.now() - t0);
  return group;
}

/** draw calls (meshes) and triangles of the area */
function stats(root) {
  let meshes = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return { drawCalls: meshes, triangles: Math.round(tris) };
}

function registerAnchors(A) {
  const { ctx, el } = A;
  // extra: fields for the sim — `stand` (site amot [X, Y, Z]: where the worker stands for an item anchor, whose pos is
  // the item itself), `target` (site amot: what a station's worker faces and handles), row / col / pillar / tamid
  const add = (name, pos, heading, label, extra = {}) => ctx.addAnchor(name, { pos, heading, label, zone: undefined, ...extra });
  const top = el('altar.top').box, walk = el('altar.walkway').box, maar = el('altar.maarachah-area');
  const Zt = top.max[2];
  const kv = el('altar.kevesh'), kp = kv.params;
  const kevZ = (y) => kp.from[2] + ((kp.to[2] - kp.from[2]) * (y - kp.from[1])) / (kp.to[1] - kp.from[1]);
  const cx = (b) => (b.min[0] + b.max[0]) / 2, cy = (b) => (b.min[1] + b.max[1]) / 2;
  const wy = (walk.min[1] + 0.5);                       // the south run of the walkway (inside the horns)
  add('altar.top', [kp.to[0], wy, Zt], 0, 'Top of the Mizbeach — the kohanim\'s walkway');
  const sw = el('altar.keren.sw').box;
  add('altar.sw-horn', [sw.max[0] + 1.2, sw.max[1] + 1.0, Zt], 225, 'The SW horn — libations of wine and water (Sukkah 4:9)');
  add('altar.ramp-foot', [kp.from[0], kp.from[1] - 3, kp.from[2]], 0, 'Foot of the kevesh');
  add('altar.ramp-top', [kp.to[0] + 3, kp.to[1] - 1.5, kevZ(kp.to[1] - 1.5)], 0, 'Head of the kevesh');
  const tp = maar.params.tapuach;
  add('altar.tapuach', [walk.min[0] + 0.5, tp.center[1], Zt], 90, 'The tapuach — the ash mound (Tamid 2:2)');
  const piles = Object.fromEntries(maar.params.piles.map((p) => [p.id, p.box]));
  add('altar.maarachah.great', [walk.max[0] - 0.5, cy(piles.great), Zt], 270, 'The great ma\'arachah — its face east (Tamid 2:4)');
  add('altar.maarachah.incense', [piles.incense.max[0] + 2.2, piles.incense.max[1] + 2.0, Zt], 225, 'The second ma\'arachah — coals for the ketoret (Tamid 2:5)');
  add('altar.maarachah.kiyum', [piles['kiyum-haesh'].max[0] + 1.5, piles['kiyum-haesh'].min[1] - 1.5, Zt], 315, 'The third ma\'arachah — for keeping the fire (Yoma 45a)');
  add('altar.sovev', [kp.to[0] + kv.params.width / 2 + 2.5, el('altar.body').box.min[1] + 0.5, el('altar.body').box.max[2]], 90, 'The sovev');
  // the 24 rings (Middot 3:5): 'altar.ring.<i>' with i = row × cols + col, rows numbered from the altar northward and
  // columns from the west (0-based), as site.js params.positions. pos = the ring in the pavement; the animal lies with
  // its head south and face west, the shochet east of it facing west (Tamid 4:1) — `stand`. The tamid rings are site.js
  // tamidMorning (NW corner, second ring) / tamidAfternoon (NE corner, second ring), also as 'altar.ring.tamid-*'.
  const rp = el('altar.rings').params;
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const tamidOf = (P) => (same(P, rp.tamidMorning.ring) ? 'morning' : same(P, rp.tamidAfternoon.ring) ? 'afternoon' : null);
  const ringIndex = {};
  rp.positions.forEach(([X, Y, Z], i) => {
    const row = Math.floor(i / rp.cols), col = i % rp.cols, tamid = tamidOf([X, Y]);
    if (tamid) ringIndex[tamid] = i;
    add(`altar.ring.${i}`, [X, Y, Z], 270,
      `Ring ${i} — row ${row} from the altar, column ${col} from the west${tamid ? ` — the ${tamid} tamid's ring (Tamid 4:1)` : ''}; head south, face west, the shochet east of it facing west`,
      { row, col, stand: [X + 1.2, Y, Z], ...(tamid ? { tamid } : {}) });
  });
  for (const [k, spec, where] of [['morning', rp.tamidMorning, 'NW corner'], ['afternoon', rp.tamidAfternoon, 'NE corner']]) {
    const [X, Y, Z] = spec.ring;
    add(`altar.ring.tamid-${k}`, [X, Y, Z], 270, `${k === 'morning' ? 'Morning' : 'Afternoon'} tamid — ${where}, second ring (Tamid 4:1) = altar.ring.${ringIndex[k]}`,
      { ring: ringIndex[k], tamid: k, stand: [X + 1.2, Y, Z] });
  }
  // the eight marble tables (Shekalim 6:4; Rambam BhB 5:14): pos = the middle of the top, the worker on the north side
  // (coming from the hooks), facing south
  el('altar.marble-tables').params.tables.forEach((t, i) => add(`altar.table.${i}`, [cx(t), cy(t), t.max[2]], 180,
    `Marble table ${i} from the west — the pieces laid on it and the innards rinsed (Shekalim 6:4; Tamid 4:2)`, { stand: [cx(t), t.max[1] + 0.9, t.min[2]] }));
  const nn = el('altar.nanasin').params;
  // the iron hooks: 'altar.hook.<pillar>.<row>', pos = the crook of the hook on the pillar's south face (toward the
  // tables), where the hind leg pierced at the hock hangs (Tamid 4:2); rows low → high (lamb, ram, bull — Rash,
  // Bartenura); the flayer stands south of the carcass facing north
  const ROW = ['low — a lamb', 'middle — a ram', 'high — a bull'];
  (A.hookPoints || []).forEach((rows, p) => rows.forEach((h, r) => add(`altar.hook.${p}.${r}`, h, 0,
    `Nanas ${p} from the west, hook row ${r} (${ROW[r] || r}) on its south face: the carcass hangs here and is flayed (Middot 3:5; Tamid 4:2)`,
    { pillar: p, row: r, stand: [h[0], h[1] - 1.3, nn.pillars[p][2]] })));
  nn.pillars.forEach(([X, Y, Z], i) => add(`altar.nanas.${i + 1}`, [X, Y - 2.0, Z], 0, `Dwarf pillar ${i + 1} (nanas)`));
  nn.flayingStations.forEach(([X, Y, Z], i) => add(`altar.flaying.${i + 1}`, [X, Y - 0.8, Z], 0, `Flaying station ${i + 1}, between the pillars`));
  const k = el('altar.kiyor');
  add('altar.kiyor', [k.box.max[0] + 2.5, k.params.center[1], k.box.min[2]], 270, 'The kiyor (Ben Katin\'s twelve spigots)');
  const us = el('altar.ulam-steps'), prof = us.params.profile;
  add('altar.ulam-steps.bottom', [us.params.apron.min[0] + 0.5, (us.box.min[1] + us.box.max[1]) / 2, us.box.min[2]], 270, 'Foot of the Ulam steps');
  add('altar.ulam-steps.top', [prof[prof.length - 1].riserX - 1.5, (us.box.min[1] + us.box.max[1]) / 2, prof[prof.length - 1].topZ], 90, 'Head of the Ulam steps (Birkat Kohanim — Tamid 7:2)');
  // the magrefah thrown "between the Ulam and the altar" (Tamid 5:6) — in the strip north of the steps ⚙
  const bh = el('altar.bein-haulam').box;
  add('altar.magrefah', [cx(bh), us.box.max[1] + 3, bh.min[2]], 270, 'The magrefah is thrown here, between the Ulam and the altar (Tamid 5:6)');
  // the trumpeters at the table of the fats (Tamid 7:3) and Ben Arza's cymbal by the duchan ⚙
  const tm = el('altar.table.marble').box;
  add('altar.trumpeters', [tm.min[0] - 0.8, cy(tm), tm.min[2]], 0, 'The two trumpeters stand at the table of the fats (Tamid 7:3)');
  const du = el('azarah.duchan').box;
  add('altar.ben-arza', [du.min[0] - 0.5, el('altar.yesod').box.min[1] + 12, el('azarah.ezrat-kohanim').box.min[2]], 270, 'Ben Arza with the cymbal, by the duchan (Tamid 7:3; Shekalim 5:1)');
  const bd = el('altar.beit-hadeshen').box;
  add('altar.beit-hadeshen', [bd.max[0] + 2.5, cy(bd), bd.min[2]], 270, 'Beit HaDeshen — the ash place east of the kevesh (Tamid 1:4)');
  const ss = el('altar.shit-slab').box;
  add('altar.shit-slab', [ss.min[0] - 2.5, ss.min[1] - 1.0, ss.max[2]], 60, 'The marble slab with its ring over the shit (Middot 3:3)');
  const rv = el('altar.kevesh.revuvah').box;
  add('altar.revuvah', [rv.min[0] - 3.5, cy(rv), el('altar.kevesh').box.min[2]], 90, 'The revuvah window in the kevesh (Middot 3:3)');
  const yr = el('altar.kevesh.ramp-yesod').params.segments[1].box;
  add('altar.yesod-ramp', [yr.min[0] + 3, cy(yr), yr.max[2]], 270, 'The small ramp to the yesod (Zevachim 62b)');
  registerStations(A, { cx, cy, kevZ, Zt, walk, piles });
}

/**
 * The offerings.js STATIONS that fall in this area, as 'station.<id>' anchors: pos = where the kohen (or owner)
 * stands to do the act (a floor point), heading = the way he faces, `target` = the site point he works on. Stations
 * with an `at` on the pavement keep it; element-only stations get a working spot here. The band stations (rings,
 * nanasin, marble-tables, tzafon) are served by the per-item anchors (altar.ring.<i>, altar.hook.<p>.<r>,
 * altar.table.<i>, altar.flaying.<n>).
 */
function registerStations(A, { cx, cy, kevZ, Zt, walk, piles }) {
  const { ctx, el } = A;
  const st = (id, pos, heading, label, target) => {
    if (!STATIONS[id]) return;
    ctx.addAnchor(`station.${id}`, { pos, heading, label, zone: STATIONS[id].zone, station: id, ...(target ? { target } : {}) });
  };
  const headTo = (from, to) => ((Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI + 360) % 360;
  const at = (id) => STATIONS[id]?.at;
  const yes = el('altar.yesod').box, body = el('altar.body').box;
  // below the line, on the pavement
  for (const [id, corner, label] of [['altar-ne', [yes.max[0], yes.max[1]], 'NE corner from the pavement: the first of "two that are four"'],
    ['altar-sw', [yes.min[0], yes.min[1]], 'SW corner from the pavement: the second of "two that are four"; the bird chatat'],
    ['hagashah', [yes.min[0], yes.min[1]], 'The meal-offering brought to the point of the SW corner, below (Zevachim 6:2)']]) {
    const p = at(id);
    if (p) st(id, p, headTo(p, corner), label, [corner[0], corner[1], yes.max[2]]);
  }
  // the remainder poured on the southern yesod: from the yesod ramp's level run, facing north
  if (at('yesod-south')) {
    const lr = el('altar.kevesh.ramp-yesod').params.segments[1].box, p = at('yesod-south');
    st('yesod-south', [p[0], lr.max[1] - 0.6, lr.max[2]], 0, 'The southern yesod — the remainder of the bloods poured out (Zevachim 5:3)', p);
  }
  // the kevesh: up on the east half; the limbs laid and salted on the lower half, west side (Tamid 4:3)
  const kb = el('altar.kevesh').box, kw = kb.max[0] - kb.min[0];
  st('kevesh', [kb.min[0] + 0.75 * kw, kb.min[1] - 1.0, kb.min[2]], 0, 'Foot of the kevesh, its east half — up on the east (Zevachim 6:3)');
  const fs = STATIONS['kevesh-salting']?.f;
  if (fs) {
    const tx = kb.min[0] + fs[0] * kw, ty = kb.min[1] + fs[1] * (kb.max[1] - kb.min[1]);
    st('kevesh-salting', [tx + 1.4, ty, kevZ(ty)], 270, 'Lower half of the kevesh, west side: the limbs laid and salted (Tamid 4:3)', [tx, ty, kevZ(ty)]);
  }
  const rs = el('altar.kevesh.ramp-sovev').params;
  const ym = (rs.from[1] + rs.to[1]) / 2, zm = rs.from[2] + ((rs.to[2] - rs.from[2]) * (ym - rs.from[1])) / (rs.to[1] - rs.from[1]);
  st('ramp-sovev', [rs.from[0], ym, zm], 0, 'The small ramp down to the sovev (Zevachim 62b)');
  st('sovev', [rs.to[0], body.min[1] + 0.5, body.max[2]], 90, 'On the sovev, where the small ramp lands — turning east toward the SE horn (Zevachim 5:3)');
  // the horns from the sovev's corner squares (offerings.js: the chatat's blood "from the sovev", SE → NE → NW → SW)
  for (const [k, sx, sy] of [['se', 1, -1], ['ne', 1, 1], ['nw', -1, 1], ['sw', -1, -1]]) {
    const hb = el(`altar.keren.${k}`).box;
    const p = [sx > 0 ? body.max[0] - 0.5 : body.min[0] + 0.5, sy > 0 ? body.max[1] - 0.5 : body.min[1] + 0.5, body.max[2]];
    const tgt = [cx(hb), cy(hb), hb.max[2]];
    st(`horn-${k}`, p, headTo(p, tgt), `The ${k.toUpperCase()} horn, from the sovev's corner (Zevachim 5:3)`, tgt);
  }
  st('maarachah', [walk.max[0] - 0.5, cy(piles.great), Zt], 270, 'Before the great ma\'arachah, its face east (Tamid 2:4)', [cx(piles.great), cy(piles.great), Zt]);
  const cups = el('altar.libation-cups').box;
  st('cups', [cx(cups), cups.max[1] + 0.6, Zt], 180, 'At the silver cups by the SW horn — the libations (Sukkah 4:9)', [cx(cups), cy(cups), cups.max[2]]);
  for (const [id, eid, label] of [['table-marble', 'altar.table.marble', 'At the marble table west of the kevesh (Shekalim 6:4)'],
    ['table-silver', 'altar.table.silver', 'At the silver table west of the kevesh (Shekalim 6:4)']]) {
    const t = el(eid).box;
    st(id, [t.max[0] + 0.9, cy(t), t.min[2]], 270, label, [cx(t), cy(t), t.max[2]]);
  }
  const bd = el('altar.beit-hadeshen').box;
  st('beit-hadeshen', [bd.max[0] + 0.9, cy(bd), bd.min[2]], 270, 'Beit HaDeshen, east of the kevesh — the ash place; notar burned here by day', [cx(bd), cy(bd), bd.max[2]]);
  // the stations on the open pavement (offerings.js `at`)
  const alt = [cx(body), cy(body)];
  if (at('kemitzah')) st('kemitzah', at('kemitzah'), headTo(at('kemitzah'), alt), 'The handful taken (Zevachim 6:1) — on the pavement west of the kevesh');
  if (at('tenufah')) st('tenufah', at('tenufah'), 270, 'The waving "before God" — east of the altar, facing west (Menachot 61a)');
  if (at('kitchen')) st('kitchen', at('kitchen'), 270, 'The cooking place — the cook at the hearth (Zevachim 11:4)', A.kitchen?.centre);
  if (at('meal')) st('meal', at('meal'), 270, 'Kohanim eat the most-holy portions standing, within the hangings (Zevachim 5:3)');
}

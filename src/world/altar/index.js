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
//
// Static parts go through one StaticBatcher (one draw call per material). Movables (ctx.movables):
//   'altar.kiyor'               userData.raise(f) — 1 up (in use), 0 sunk in its well overnight; turns the wheel too
//   'wheel:altar.kiyor.muchni'  userData.spin(rad) about the E–W axle
//   'altar.libation-cups', 'altar.libation-cup.water', 'altar.libation-cup.wine'   the silver cups at the SW horn
//   'altar.machtah'             the silver fire-pan in its niche (Tamid 1:4)
//   'altar.two-logs'            the two gizrin laid on the great pile (toggle .visible)
// Fires: 'altar.maarachah.great' | '.incense' | '.kiyum' (kind 'pyre', smoke). Anchors: 'altar.*' (see registerAnchors).
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
    ['kiyor', buildKiyor], ['ulam-steps', buildUlamSteps], ['water', buildWater],
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
  const add = (name, pos, heading, label) => ctx.addAnchor(name, { pos, heading, label, zone: undefined });
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
  // the 24 rings: rows numbered from the altar northward, rings from the west (Tamid 4:1: the morning tamid at the
  // NW corner on the second ring, the afternoon one at the NE corner on the second ring — site.js tamidMorning/Afternoon)
  const rp = el('altar.rings').params;
  rp.positions.forEach(([X, Y, Z], i) => {
    const row = Math.floor(i / rp.cols) + 1, ring = (i % rp.cols) + 1;
    add(`altar.ring.r${row}c${ring}`, [X + 1.2, Y, Z], 270, `Ring ${ring} of row ${row} (the shochet east of it, facing west — Tamid 4:1)`);
  });
  add('altar.ring.tamid-morning', [rp.tamidMorning.ring[0] + 1.2, rp.tamidMorning.ring[1], rp.tamidMorning.ring[2]], 270, 'Morning tamid — NW corner, second ring (Tamid 4:1)');
  add('altar.ring.tamid-afternoon', [rp.tamidAfternoon.ring[0] + 1.2, rp.tamidAfternoon.ring[1], rp.tamidAfternoon.ring[2]], 270, 'Afternoon tamid — NE corner, second ring (Tamid 4:1)');
  el('altar.marble-tables').params.tables.forEach((t, i) => add(`altar.marble-table.${i + 1}`, [cx(t), t.min[1] - 1.0, t.min[2]], 0, `Marble table ${i + 1}`));
  const nn = el('altar.nanasin').params;
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
}

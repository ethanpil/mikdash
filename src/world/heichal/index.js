// World builder: the Heichal — otem, Ulam (facade, rovadin, the five milah lintels, interior fittings, the beit
// hachalifot wings), the great gate with its four doors and wickets, the Kodesh (gold relief lining, Menorah,
// Shulchan, golden altar, sotah slab), the amah traksin and the two parochot, the Kodesh HaKodashim (Even Shetiyah),
// the ta'im, mesibah and water-descent house, the aliyah, the ceiling and roof courses, ma'akeh and kalya orev.
// (ARCHITECTURE.md §5.)
//
// Every position and dimension comes from src/data/site.js (ctx.el); the research (report Parts V, VII §21–§25,
// IX §37–§38, XI locks, XIV) gives form and material; reconstruction choices: docs/decisions/build-heichal.md.
//
//   lib/geo.js    site-frame meshers: greedy box solids, sweeps, lathes, tubes
//   lib/kit.js    material buckets (+ UV tags) → StaticBatcher, material variants, instancing, door leaves, thick drapes
//   uv.js         the relief / rovadin / timber UV mappers
//   shell.js      the masonry solid, F1 splays, mesibah and roof stairs, kalya orev, stringcourses
//   ulam.js       Ulam interior: tables, tie-beams, chains, vine, nivreshet, crowns, knife niches, curtains
//   doors.js      the great gate (4 leaves), the wickets, the inner doors
//   kodesh.js     Kodesh / KhK lining (coffered kiyur ceiling, cornice), parochot, Even Shetiyah, aliyah fittings, lamps
//   vessels.js    Menorah (+ the stone of three steps), Shulchan with the bread, golden altar, the Ulam's tables
//
// Movables: 'door:heichal.gate.great' (userData.open(f); openGroup('outer'|'inner', f)), 'door:heichal.gate.wicket-n',
// 'door:heichal.gate.wicket-s' (never opened), 'door:heichal.chalifot.{n,s}.wicket', 'door:heichal.ta.door-ne',
// 'door:heichal.ta-wall.north', 'door:heichal.aliyah.door', 'curtain:heichal.ulam-curtain', 'curtain:heichal.gate-curtain',
// 'curtain:heichal.parochet.outer', 'curtain:heichal.parochet.inner', 'heichal.nivreshet',
// 'heichal.menorah.lamp-0' … '-6' (east → west; userData.setLit(v)).  Fires: 'heichal.menorah.lamp-0' … '-6' (the
// ner ma'aravi 'always'; the six others 'service', lit at 1 until the sim cleans / lights them).
import { AMAH } from '../../core/units.js';
import { zoneAtSite } from '../../data/site.js';
import { Kit } from './lib/kit.js';
import { B } from './lib/geo.js';
import { registerUV } from './uv.js';
import { buildShell } from './shell.js';
import { buildDoors } from './doors.js';
import { buildUlam } from './ulam.js';
import { buildKodesh } from './kodesh.js';
import { buildUlamTables } from './vessels.js';
import { tube } from './lib/geo.js';

export async function build(ctx) {
  const t0 = performance.now();
  const kit = new Kit(ctx, 'heichal');
  const el = (id) => ctx.el(id);
  const site = ctx.site;
  const d = kit.detail;
  const kod = el('heichal.kodesh').box, khk = el('heichal.khk').box, trk = el('heichal.amah-traksin').box;
  const gate = el('heichal.gate.great').box, gc = el('heichal.gate-curtain').box;
  const H = {
    ctx, kit, el, d, AMAH, site,
    axisY: site.axisY,
    zF: el('heichal.kodesh').params.floorZ,
    rooms: { ulam: el('heichal.ulam').box, kodesh: kod, traksin: trk, khk, aliyah: el('heichal.aliyah').box },
    yBodyS: el('heichal.outer-wall.south').box.min[1],
    yBodyN: el('heichal.mesibah-wall').box.max[1],
    gateHalfW: (gate.max[1] - gate.min[1]) / 2,
    doorTopZ: gate.max[2],
    gateSurround: { y0: gc.min[1], y1: gc.max[1], z1: gc.max[2] },
    reliefZ0: kod.min[2] + 1,          // plinth 1 amah, six registers of 6 amot, frieze 3 amot ⚙
    reliefZ1: kod.min[2] + 1 + 36,
    mesibahFootLanding: 10,            // ⚙ level landing at the NE door before the first flight
    posts: [],
    anchors: [],
    stats: {},
  };
  // rovadin (Rambam BhB 4:9): from the Heichal floor, 1 plain + 3 rovad repeated, the top rovad 4 — ends exactly on the
  // ma'akeh's top (+115): 22 × 4 + 1 + 4 = 93
  H.bandBase = H.zF;
  H.rovadRecess = 1 / 3;             // ⚙ the plain courses sit a third of an amah behind the rovadin: each rovad's head a ledge
  H.lintelProud = 1 / 6;             // ⚙ the milah lintels stand a sixth proud, the stone courses between set back a sixth
  H.kiyurUlamScale = 0.5 / 0.36;     // ⚙ the +62 kiyur round the Ulam block projects ½ amah (0.36 elsewhere)
  H.bandTopK = Math.round((el('heichal.maakeh').box.max[2] - 5 - H.zF) / 4);
  // F1 windows (site box spans the band; 5 per side, 1 wide inside, 2 outside)
  const f1e = el('heichal.windows.f1');
  const nW = f1e.params.perSide, wIn = f1e.params.widthInside, wOut = f1e.params.widthOutside;
  const span = f1e.box.max[0] - f1e.box.min[0] - wOut;
  const wallUpper = el('heichal.wall.north').params.profile.at(-1).t;
  H.f1 = { z0: f1e.params.band[0], z1: f1e.params.band[1], wIn, wOut, windows: [] };
  for (let i = 0; i < nW; i++) {
    const x = f1e.box.min[0] + wOut / 2 + (span * i) / (nW - 1);
    H.f1.windows.push({ x, side: 'N', inner: kod.max[1], outer: kod.max[1] + wallUpper, y0: kod.max[1], y1: kod.max[1] + wallUpper });
    H.f1.windows.push({ x, side: 'S', inner: kod.min[1], outer: kod.min[1] - wallUpper, y0: kod.min[1] - wallUpper, y1: kod.min[1] });
  }
  buildCells(H);
  buildNiches(H);
  registerUV(kit, H);

  buildShell(H);
  buildDoors(H);
  buildUlam(H);
  buildUlamTables(H);
  buildKodesh(H);
  // the cedar posts at the aliyah door (Middot 4:5)
  for (const p of H.posts) kit.geo(tube([p.x, p.y, p.z0], [p.x, p.y, p.z1], 0.3, [6, 8, 12, 14][d], true), 'cedar_v', { collide: true });
  anchors(H);

  const group = kit.finish();
  group.name = 'heichal';
  // stats: draw calls and triangles of this area
  let calls = 0, tris = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    calls++;
    const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += o.isInstancedMesh ? n * o.count : n;
  });
  group.userData.stats = { calls, triangles: Math.round(tris), detail: d, buildMs: Math.round(performance.now() - t0), ...H.stats, fallbacks: kit.fallbacks, anchors: H.anchors.length };
  return group;
}

/** named places (site amot; Z = the floor stood on) with a heading for a good view */
function anchors(H) {
  const { ctx, el } = H;
  const AY = H.axisY, zF = H.zF;
  const add = (name, pos, heading, label, extra = {}) => {
    ctx.addAnchor(name, { pos, heading, label, zone: zoneAtSite(pos[0], pos[1], pos[2] + 0.5) || undefined, ...extra });
    H.anchors.push(name);
  };
  const alt = ctx.elOpt('altar.top');
  const altW = alt?.box ? alt.box.min[0] + 1.5 : 204.5;
  const altZ = alt?.box ? alt.box.max[2] : 25;
  add('heichal.ulam-front', [altW, AY, altZ], 270, 'The Ulam front, from the altar');
  add('heichal.ulam', [171, AY, zF], 270, 'The Ulam');
  add('heichal.great-gate', [166.5, AY, zF], 270, 'The great gate of the Heichal');
  add('heichal.chalifot', [168.5, (el('heichal.chalifot.n').box.min[1] + el('heichal.chalifot.n').box.max[1]) / 2, zF], 0, 'Beit HaChalifot (north)');
  // the foot of each gold chain (south → north), on the Ulam floor below it: the young kohanim take hold here and climb
  // to see the crowns in the windows over the gate (Middot 3:8); `foot` = the chain's lowest point (site amot)
  (H.chainFeet || []).forEach((f, i) => {
    add(`heichal.ulam.chain-${i}`, [f[0], f[1], zF], 270, `Gold chain ${i} from the south — the young kohanim climb it to see the crowns (Middot 3:8)`, { foot: f });
  });
  add('heichal.kodesh', [154, AY, zF], 270, 'The Kodesh, from the entrance');
  const mb = el('heichal.menorah').box, sb = el('heichal.shulchan').box, ab = el('heichal.mizbach-hazahav').box;
  const head = (from, to) => ((Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI + 360) % 360;
  const mc = [(mb.min[0] + mb.max[0]) / 2, (mb.min[1] + mb.max[1]) / 2], sc = [(sb.min[0] + sb.max[0]) / 2, (sb.min[1] + sb.max[1]) / 2];
  const mp = [mc[0] + 3.5, mc[1] + 4.6], sp = [sc[0] + 3.5, sc[1] - 4.2];
  add('heichal.menorah', [mp[0], mp[1], zF], head(mp, mc), 'The Menorah');
  add('heichal.shulchan', [sp[0], sp[1], zF], head(sp, sc), 'The Shulchan');
  add('heichal.golden-altar', [ab.max[0] + 4, AY, zF], 270, 'The golden altar');
  add('heichal.amah-traksin', [116.5, H.rooms.kodesh.min[1] + 1.2, zF], 0, 'Amah traksin — between the parochot');
  const khk = H.rooms.khk;
  add('heichal.khk', [(khk.min[0] + khk.max[0]) / 2, AY, zF], 270, 'Kodesh HaKodashim');
  const kg = el('heichal.even-shetiyah').params.kgStation;
  add('heichal.khk.kg-station', [kg[0], kg[1], kg[2]], el('heichal.even-shetiyah').params.kgFacing, 'Before the Even Shetiyah');
  add('heichal.ne-ta', [152, 350, zF], 180, 'The NE ta (the daily way in)');
  add('heichal.mesibah', [154, 359, zF], 270, 'The mesibah');
  const tr = el('heichal.taim.roofs').params.z;
  add('heichal.taim-roofs', [82, 359, tr], 180, "The roofs of the ta'im");
  add('heichal.aliyah-door', [137, 309, el('heichal.aliyah').params.floorZ], 0, 'The door of the aliyah');
  add('heichal.aliyah', [137, AY, el('heichal.aliyah').params.floorZ], 270, 'The aliyah');
  const rz = el('heichal.roof').params.z;
  add('heichal.roof', [140, AY, rz], 90, 'The Heichal roof');
  add('heichal.roof.east', [176, AY, rz], 90, 'The roof edge over the Ulam');
}

/** the 38 ta'im (site cells) as rooms; doors in the partitions (right/left) and hatches to the cell above (Middot 4:3) ⚙ */
function buildCells(H) {
  const { el, d } = H;
  const all = ['north', 'south', 'west'].flatMap((k) => el(`heichal.taim.${k}`).params.cells);
  const neX = Math.max(...all.filter((c) => c.side === 'N' && c.story === 1).map((c) => c.box.max[0]));
  const isNE = (c) => c.side === 'N' && c.story === 1 && Math.abs(c.box.max[0] - neX) < 1e-6;
  const cells = d >= 1 ? all : all.filter(isNE);
  H.cells = cells;
  H.cellOpenings = [];
  if (d < 1) return;
  const along = (c) => (c.side === 'W' ? 1 : 0);   // the row's direction axis
  // partition doors between consecutive cells of a row (2 wide, 5 high) ⚙
  for (const side of ['N', 'S', 'W']) for (const story of [1, 2, 3]) {
    const row = cells.filter((c) => c.side === side && c.story === story).sort((a, b) => a.box.min[along(a)] - b.box.min[along(a)]);
    for (let i = 0; i + 1 < row.length; i++) {
      const a = row[i].box, b = row[i + 1].box, ax = along(row[i]), cx = 1 - ax;
      const mid = (a.min[cx] + a.max[cx]) / 2;
      const min = [0, 0, a.min[2]], max = [0, 0, a.min[2] + 5];
      min[ax] = a.max[ax]; max[ax] = b.min[ax];
      min[cx] = mid - 1; max[cx] = mid + 1;
      H.cellOpenings.push({ box: B(min[0], min[1], min[2], max[0], max[1], max[2]), o: 'door' });
    }
  }
  // hatches to the cell above (1.5 × 1.5) at the lower cell's centre when it lies inside an upper cell
  for (const c of cells) {
    if (c.story === 3) continue;
    const cx = (c.box.min[0] + c.box.max[0]) / 2, cy = (c.box.min[1] + c.box.max[1]) / 2;
    const upC = cells.find((u) => u.side === c.side && u.story === c.story + 1
      && cx - 0.75 > u.box.min[0] && cx + 0.75 < u.box.max[0] && cy - 0.75 > u.box.min[1] && cy + 0.75 < u.box.max[1]);
    if (!upC) continue;
    H.cellOpenings.push({ box: B(cx - 0.75, cy - 0.75, c.box.max[2], cx + 0.75, cy + 0.75, upC.box.min[2]), o: 'door' });
  }
}

/** the knife niches of the beit hachalifot: 12 a wing in two rows of six on each end wall; Bilgah's sealed (south) ⚙ */
function buildNiches(H) {
  const { el } = H;
  H.niches = [];
  const zF = H.zF;
  for (const k of ['n', 's']) {
    const w = el(`heichal.chalifot.${k}`).box;
    const face = k === 'n' ? w.max[1] : w.min[1], dir = k === 'n' ? 1 : -1;
    const W = w.max[0] - w.min[0], nw = 1, gap = (W - 6 * nw) / 7, depth = 0.75;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
      const x0 = w.min[0] + gap + i * (nw + gap);
      const z0 = zF + 1.75 + r * 1.5;
      const y0 = face, y1 = face + dir * depth;
      const idx = r * 6 + i;
      const sealed = k === 's' && idx === 2;   // Bilgah, the 15th mishmar = the 3rd of the south wing (Sukkah 56b)
      H.niches.push({ wing: k, idx, sealed, box: B(x0, Math.min(y0, y1), z0, x0 + nw, Math.max(y0, y1), z0 + 1), x0, z0, face, dir });
      if (sealed) H.niches.at(-1).box = B(x0, Math.min(face, face + dir * 0.06), z0, x0 + nw, Math.max(face, face + dir * 0.06), z0 + 1);
    }
  }
}

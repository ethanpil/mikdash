// World builder: the courts — Ezrat Nashim, the fifteen steps, Sha'ar Nikanor, Ezrat Yisrael and the duchan, the
// Azarah walls, gates and flights, the chambers, Beit HaMoked and the underground route (ARCHITECTURE.md §5).
//
// Every position and dimension comes from src/data/site.js (ctx.el); the research (report Parts I–V, VII, XI) gives
// form and material; reconstruction choices are logged in docs/decisions/build-courts.md.
//
//   lib/geo.js     site-frame meshers: greedy box solids, sweeps, lathes
//   lib/kit.js     material buckets → StaticBatcher, instanced sets, door leaves & gate curtains (movables)
//   lib/parts.js   chamber shells, straight flights, spiral stairs, lamps
//   masonry.js     court walls (all openings/voids/cutouts), floors & substructures, cornices, gate frames
//   en.js          Ezrat Nashim: 15 steps, gezuztra, corner chambers, Chasha'im, music cellars, east gate
//   nikanor.js     Sha'ar Nikanor, wickets, Pinchas / chavitin chambers, Ezrat Yisrael & duchan
//   azarah.js      N/S gates & flights, Water Gate house + Beit Avtinas + mikveh, Nitzotz + Beit HaNitzotz, Kelim
//   chambers.js    Gazit, Golah, Etz/Parhedrin, Melach, Parvah (+ roof mikveh), Medichin (+ stair)
//   moked.js       Beit HaMoked and the underground passage / Beit HaTevilah
//   watch.js       night-watch post lamps; the lamps of the Shabbat dawn search inside the Azarah
//
// Movables: 'door:<element id>' (userData.open(f), f 0 shut … 1 folded back), 'curtain:<gate id>' (userData.open(f),
// 1 = gathered), 'wheel:azarah.chamber.golah' (userData.spin(rad)), 'azarah.moked.keys-slab' (userData.lift(f) = open(f),
// 0 in place … 1 raised on its ring; setKeys(bool | n | ids) the keys on the chain below). Anchors: 'courts.*'.
// Fires: 'courts.*' (lamps lit before Shabbat, schedule 'service', intensity 0: 'courts.kelim.lamp-w|-s',
// 'courts.moked.lambs.lamp', and the Shabbat dawn search's 'courts.azarah.lamp-{wicket,ne,nw,sw,s,se,chavitin}').
import { Kit, Doors, Curtains, leafGeometry } from './lib/kit.js';
import { lathe } from './lib/geo.js';
import { AMAH } from '../../core/units.js';
import { zoneAtSite } from '../../data/site.js';
import { buildMasonry, buildFloors, doorCase } from './masonry.js';
import { buildEzratNashim } from './en.js';
import { buildNikanor } from './nikanor.js';
import { buildAzarah } from './azarah.js';
import { buildChambers } from './chambers.js';
import { buildMoked } from './moked.js';
import { buildWatch } from './watch.js';

/** leaf styles by name: panelled gold plate, cast Corinthian bronze, cedar boards. `unit`: one canonical leaf
 *  [w, h] scaled per instance (cedar doors of one height class share one draw call). */
const LEAF = {
  // astragal: the leaves of the gates' pairs carry a lapping meeting astragal (lib/kit.js leafGeometry o.astragal)
  goldLeaf: { style: 'gate', key: 'gold_plate', t: 0.4, unit: [4.98, 20], astragal: true },   // every gate leaf is half a 10-amah gate
  bronzeLeaf: { style: 'bronze', key: 'bronze_corinthian', t: 0.45, astragal: true },
  bronzeWicket: { style: 'bronze', key: 'bronze_corinthian', t: 0.3 },
  cedarTall: { style: 'plank', key: 'cedar_v', t: 0.32, unit: [5, 20] },     // the 20-amah EN corner-chamber doors
  cedarLeaf16: { style: 'plank', key: 'cedar_v', t: 0.32, unit: [4, 16] },
  cedarLeaf16n: { style: 'plank', key: 'cedar_v', t: 0.32, unit: [4, 16] },
  cedarSmall: { style: 'plank', key: 'cedar_v', t: 0.32, unit: [4, 16] },
  cedarSmall4x8: { style: 'plank', key: 'cedar_v', t: 0.32, unit: [4, 16] },
};

export async function build(ctx) {
  const t0 = performance.now();
  const kit = new Kit(ctx, 'courts');
  const site = ctx.site;
  const C = {
    ctx, kit, d: kit.detail, AMAH,
    el: (id) => ctx.el(id),
    datums: site.datums,
    axisY: site.axisY,
    gateX: ['delek', 'bechorot', 'mayim'].map((k) => { const b = ctx.el(`azarah.gate.${k}`).box; return (b.min[0] + b.max[0]) / 2; }),
    floorHoles: [],
    anchors: [],
  };
  C.doors = new Doors(kit);
  C.curtains = new Curtains(kit, 'parochet', 6, 20);
  C.leafSet = (name, w, h) => {
    const s = LEAF[name];
    const lo = { astragal: !!s.astragal }, tag = s.astragal ? ':a' : '';
    if (s.unit) return C.doors.leafSet(`${s.style}:${s.key}:${s.unit.join('x')}${tag}`, s.key, () => leafGeometry(s.unit[0], s.unit[1], s.t, s.style, C.d, [], lo));
    return C.doors.leafSet(`${name}:${w.toFixed(2)}x${h.toFixed(2)}${tag}`, s.key, () => leafGeometry(w, h, s.t, s.style, C.d, [], lo));
  };
  const leafScale = (name, w, h) => { const u = LEAF[name].unit; return u ? [w / u[0], h / u[1], 1] : null; };
  C.doorPair = (id, name, s0, s1, axis, at, z0, into, o = {}) => {
    const h = o.h ?? 20, w = (s1 - s0) / 2 - 0.02;
    const set = C.leafSet(name, w, h), scale = leafScale(name, w, h);
    const P = (s) => (axis === 'x' ? [s, at, z0] : [at, s, z0]);
    const along = axis === 'x' ? [1, 0] : [0, 1];
    const maxAngle = o.maxAngle;
    return C.doors.addDoor(id, [{ set, scale, hinge: P(s0), along, into, maxAngle }, { set, scale, hinge: P(s1), along: [-along[0], -along[1]], into, maxAngle }],
      { open: o.open ?? 1, center: P((s0 + s1) / 2), label: o.label });
  };
  C.doorSingle = (id, name, hinge, along, into, w, h, o = {}) => {
    const set = C.leafSet(name, w - 0.04, h - 0.02), scale = leafScale(name, w - 0.04, h - 0.02);
    return C.doors.addDoor(id, [{ set, scale, hinge, along, into }], { open: o.open ?? 1, center: hinge, label: o.label, kind: 'door' });
  };
  C.curtain = (id, left, along, label) => C.curtains.add(id, { left, along, open: 1, label });
  // the Kohen Gadol's linen sheets (Yoma 3:4): spread only for his Yom Kippur immersions — rolled to the poles by default
  C.screens = new Curtains(kit, 'curtain_linen', 3, 4.5, 0.05, 'screens');
  C.screen = (id, left, along, span, h, label) => C.screens.add(id, { left, along, span, h, open: 1, label });
  /** marble door-case on a court face of a chamber door or wicket (masonry.doorCase, narrower band) */
  C.doorCase = (face, band = 0.7, proud = 0.16) => doorCase(C, kit.m('marble_white', false, true), face, band, proud);
  C.anchor = (name, pos, heading, label, extra = null) => {
    ctx.addAnchor(name, { pos, heading, label, zone: zoneAtSite(pos[0], pos[1], pos[2] + 0.5) || undefined, ...(extra || {}) });
    C.anchors.push(name);
  };
  /** marble column (Attic base, entasis, echinus-and-abacus capital — restrained, period-plausible ⚙) */
  C.column = ([x, y, z], h, r) => {
    const seg = [8, 16, 20, 28][C.d] || 16;
    const prof = C.d >= 1
      ? [[0, 0.3], [1.3 * r, 0.3], [1.3 * r, 0.45], [1.16 * r, 0.56], [1.1 * r, 0.62], [1.17 * r, 0.72], [1.06 * r, 0.82], [r, 0.88],
        [0.97 * r, h * 0.38], [0.86 * r, h - 1.05], [0.93 * r, h - 1.0], [0.93 * r, h - 0.92], [0.87 * r, h - 0.88],
        [0.92 * r, h - 0.82], [1.12 * r, h - 0.62], [1.28 * r, h - 0.45], [1.3 * r, h - 0.4], [0, h - 0.4]]
      : [[0, 0.3], [r, 0.3], [0.88 * r, h - 0.4], [0, h - 0.4]];
    kit.geo(lathe(prof, [x, y, z], seg), 'marble_white', { collide: true });
    const m = kit.m('marble_white', true, true), s = 1.35 * r;
    m.box([x - s, y - s, z], [x + s, y + s, z + 0.3]);
    m.box([x - s, y - s, z + h - 0.4], [x + s, y + s, z + h]);
  };

  buildMasonry(C);
  buildEzratNashim(C);
  buildNikanor(C);
  buildAzarah(C);
  buildChambers(C);
  buildMoked(C);
  buildFloors(C);          // last: the cistern / mikveh mouths are cut from the floors
  buildWatch(C);
  const group = kit.finish();

  // stats for the report / debugging: draw calls and triangles of this area
  let calls = 0, tris = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    calls++;
    const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += o.isInstancedMesh ? n * o.count : n;
  });
  group.userData.stats = { calls, triangles: Math.round(tris), anchors: C.anchors.length, buildMs: Math.round(performance.now() - t0), detail: C.d };
  return group;
}

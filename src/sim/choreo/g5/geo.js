// G5 geometry: the places the individuals' offerings use (offerings.js STATIONS, the altar builder's 'station.*' /
// 'altar.ring.*' / 'altar.hook.*' anchors, site.js elements) and a small authored walking graph through the court.
//
// Walks inside the court follow authored corridors (straight legs between named nodes, shortest path by Dijkstra), so
// every timeline is fixed at plan time and never depends on nav (which arrives seconds after boot and differs by tier).
// The corridors keep to the open pavement: north of the hooks, between the ring columns, the Ezrat Kohanim strip east of
// the altar, the strip west of the kevesh, the south strip in front of the chambers of salt, hides and rinsing, the
// ramps (kevesh: up on the east half, down on the west — Zevachim 6:3), the sovev and the altar top. Every node is in
// site amot [X, Y, Z]; `near: true` marks stairs and surfaces whose floor is resolved by the physics (stand floor
// nearest Z), the others are exact datums or the ramps' own linear surfaces.
import { SitePath } from '../../lib/path.js';

const D16 = 16, EY = 13.5, EN = 6, SOV = 22, TOP = 25;

/** the kevesh's surface height at Y (site.js altar.kevesh params: from [217,275.5,16] to [217,307.5,25]) */
function kevZ(ctx, y) {
  const p = ctx.elOpt('altar.kevesh')?.params;
  const f = p?.from || [217, 275.5, 16], t = p?.to || [217, 307.5, 25];
  return f[2] + ((t[2] - f[2]) * (y - f[1])) / (t[1] - f[1]);
}

const anchorSite = (ctx, name) => {
  const a = ctx.anchors?.get?.(name);
  if (!a) return null;
  const AM = ctx.units?.AMAH || 0.48;
  return { pos: [a.pos.x / AM, -a.pos.z / AM, a.pos.y / AM], heading: a.heading, stand: a.stand, target: a.target };
};

/**
 * Lanes: one ring, one hook and one marble table each. Six lanes (OFFERING_RULES.lanes.slaughter typical 2–6), the two
 * tamid rings (row 0, columns 1–2 — Tamid 4:1) never used; checkerboard so neighbouring groups have room; each lane's
 * hook on the pillar nearest its ring and its table in front of that pillar (Middot 3:5; Shekalim 6:4).
 */
const LANE_RINGS = [[1, 1], [1, 3], [2, 0], [2, 2], [3, 1], [3, 3]];   // [row, col] ⚙
const LANE_PILLARS = [3, 6, 1, 4, 2, 5];                              // nanasin index (0..7 from the west) ⚙

export function buildGeo(ctx) {
  const el = (id) => ctx.elOpt(id);
  const rp = el('altar.rings')?.params;
  const nn = el('altar.nanasin')?.params;
  const tables = el('altar.marble-tables')?.params?.tables || [];
  const K = (y) => kevZ(ctx, y);

  // ---------------------------------------------------------------- lanes
  const lanes = LANE_RINGS.map(([row, col], i) => {
    const idx = row * (rp?.cols || 4) + col;
    const ring = rp?.positions?.[idx] || [205 + 8 * col, 347.5 + 4 * row, 16];
    const p = LANE_PILLARS[i];
    const pil = nn?.pillars?.[p] || [203 + 4 * p, 383.75, 16];
    const capW = (nn?.section || 1) * 1.3;
    const hookZ = (nn?.hookRowsZ || [19.2, 19.5, 19.8]);
    const hookY = pil[1] - capW / 2 - 0.2;
    const tb = tables[p] || { min: [pil[0] - 1.25, 372.75], max: [pil[0] + 1.25, 374.25] };
    const tX = (tb.min[0] + tb.max[0]) / 2;
    const [X, Y] = ring;
    return {
      i, ringIndex: idx, ring: [X, Y, D16], label: `ring ${idx + 1}`,
      east: col >= 2,
      // waiting place before the leaning: east of the ring on its row ⚙
      hold: [X + 3.2, Y + 1.0, D16],
      // the bound animal: head south at the ring, the slaughterer east facing west (Tamid 4:1; people demo tableau)
      bound: [X, Y + 0.9, D16],
      hook: [pil[0], hookY, hookZ[0] + 0.02], hookRam: [pil[0], hookY, hookZ[1] + 0.02], pillarX: pil[0],
      flayer: [pil[0], hookY - 1.3, D16],
      table: [tX, (tb.min[1] + tb.max[1]) / 2, tb.max?.[2] ?? 17.5],
      tableStand: [tX, (tb.max?.[1] ?? 374.25) + 0.9, D16],
      // Ezrat Yisrael: where a lesser offering's owner waits between the slaughter and the waving, east of the way
      // along it (X 249.5) ⚙
      eyWait: [251.1 + (i % 2) * 1.8, Y + 0.5, EY],
      // the observer's spot for this lane: the Ezrat Kohanim strip at the ring's row, facing west
      view: { at: [240, Y + 1.5, D16], heading: 262 },
      flayView: { at: [pil[0] + 3, 371.0, D16], heading: 345 },
    };
  });

  // ---------------------------------------------------------------- stations (anchors where the altar builder made them)
  const st = (name, fallbackPos, fallbackHeading) => {
    const a = anchorSite(ctx, `station.${name}`);
    return a ? { pos: a.pos, heading: a.heading ?? fallbackHeading, target: a.target } : { pos: fallbackPos, heading: fallbackHeading };
  };
  const S = {
    altarNE: st('altar-ne', [233.3, 337.8, D16], 225),
    altarSW: st('altar-sw', [200.7, 305.2, D16], 45),
    yesodSouth: st('yesod-south', [202.5, 304.9, 17], 0),
    hagashah: st('hagashah', [200.8, 305.4, D16], 45),
    kemitzah: st('kemitzah', [203, 290, D16], 24),
    tenufah: st('tenufah', [237.5, 321.5, D16], 270),
    kitchen: st('kitchen', [238.5, 295, D16], 270),
    meal: st('meal', [238.5, 300, D16], 270),
    maarachah: st('maarachah', [229.5, 321.5, TOP], 270),
    cups: st('cups', [204.5, 309.1, TOP], 180),
    tableSilver: st('table-silver', [206.9, 281, D16], 270),
    tableMarble: st('table-marble', [206.9, 286, D16], 270),
    deshen: st('beit-hadeshen', [228.4, 285.5, D16], 270),
    salting: st('kevesh-salting', [214.4, 283.5, K(283.5)], 270),
    hornSE: st('horn-se', [231.5, 307, SOV], 135),
    hornNE: st('horn-ne', [231.5, 336, SOV], 45),
    hornNW: st('horn-nw', [202.5, 336, SOV], 315),
    hornSW: st('horn-sw', [202.5, 307, SOV], 225),
  };
  // the SW corner from the pavement. The open amah channel runs south from the corner at X 198.5–199.5 (site.js
  // azarah.amah-channel) and the small ramp's landing to the yesod fills X 201–209, Y 303.5–305.5, so the corner is
  // reached by a 1½-amah strip over the marble slab of the shit (Middot 3:3). Each role has its own place, ≥ 1¼ amot
  // from the others ⚙:
  //   point  — at the point of the corner, on the slab: the second throw of "two that are four" and its remainder poured
  //            on the yesod (Zevachim 5:4–7), the hagashah of a meal-offering "against the point of the horn" (Zevachim
  //            6:2; Sotah 14b). One user at a time: the plan books it (P.hot).
  //   birds  — the chatat ha'of kohanim along the west face just north of the corner, facing the wall (the blood is
  //            sprinkled on the wall below the line and drained on the yesod — Zevachim 6:4), one place per bird lane,
  //            each with its approach from the corridor west of it and its cage set down behind him.
  const yb = el('altar.yesod')?.box;
  const swC = yb ? [yb.min[0], yb.min[1]] : [201, 305.5];
  S.swCorner = [swC[0], swC[1], D16];
  S.swPoint = { pos: [swC[0] - 0.45, swC[1] - 0.45, D16], heading: 45 };
  S.swBird = [0, 1, 2].map((l) => {
    const y = swC[1] + 1.4 + 1.5 * l;
    return { pos: [swC[0] - 0.65, y, D16], heading: 75, approach: [swC[0] - 2.7, y, D16], cage: [swC[0] - 1.4, y + 0.3, D16] };
  });
  // inside the chambers on the south side (Middot 5:3), one place per lane so kohanim of different offerings never
  // stand in one spot: Lishkat HaMedichin (the stomach rinsed), the Parvah (hides salted), Lishkat HaMelach (salt) ⚙
  const inRoom = (id, fb, l, cols, dx, dy) => {
    const b = el(id)?.box || fb;
    const x0 = (b.min[0] + b.max[0]) / 2 - ((cols - 1) * dx) / 2;
    return [x0 + (l % cols) * dx, b.max[1] - 3.2 - Math.floor(l / cols) * dy, D16];
  };
  S.medSpot = [0, 1, 2, 3, 4, 5].map((l) => inRoom('azarah.chamber.medichin', { min: [140.25, 263], max: [152.25, 275] }, l, 3, 2.6, 2.6));
  S.parSpot = [0, 1, 2, 3, 4, 5].map((l) => inRoom('azarah.chamber.parvah', { min: [120.25, 263], max: [140.25, 275] }, l, 3, 3.0, 2.6));
  S.melSpot = [0, 1, 2].map((l) => inRoom('azarah.chamber.melach', { min: [75, 263], max: [95, 275] }, l, 3, 2.6, 2.6));
  // the lower west half of the kevesh, where the eimurim are salted (Rambam MK 6:4): north of the olah's limbs and
  // their salter (X 214–218, Y 279–283), east of the way down the west half ⚙
  S.saltE = [215.8, 285.2, K(285.2)];
  // the olah bird on the sovev at the SE horn (Zevachim 6:5): on the ledge's corner square facing the altar's wall,
  // the cage set down on the east ledge beside him ⚙
  S.seBird = { pos: [S.hornSE.pos[0], S.hornSE.pos[1], SOV], heading: S.hornSE.heading ?? 315, cage: [S.hornSE.pos[0], S.hornSE.pos[1] + 1.3, SOV] };
  // the cooking place (offerings.js STATIONS.kitchen: the hearth's east mouth; courts-daily's cook works its west
  // side): one frying place per meal-offering kohen along the mouth, each reached from the east; one place where the
  // most-holy meat, the bird chatat and the meal-offering's remainder are set down for the kohanim's meal (booked, one
  // at a time); the pick-up place for yesterday's notar south-east of the hearth ⚙
  const kc = S.kitchen.pos;
  S.fry = [0, 1, 2].map((l) => ({ pos: [kc[0] + 0.1, kc[1] - 1.1 + 1.3 * l, D16], heading: 270, approach: [kc[0] + 1.9, kc[1] - 1.1 + 1.3 * l, D16] }));
  S.drop = { pos: [kc[0] + 2.1, kc[1] + 2.6, D16], heading: 250 };
  S.pick = [kc[0] + 2.5, kc[1] - 2.4, D16];
  // the waving east of the altar (Rambam MK 9:6): one place per animal lane, the owner east facing west and the kohen
  // west of him facing east, 1.3 amot apart so the kohen's hands are beneath the owner's (Menachot 61b); each reaches
  // his place from his own side; the late bikkurim basket south of them ⚙
  const tp = S.tenufah.pos;
  const wave = (y) => ({ owner: [tp[0] + 0.65, y, D16], kohen: [tp[0] - 0.65, y, D16], ownerIn: [tp[0] + 2.8, y, D16], kohenIn: [tp[0] - 3.1, y, D16] });
  S.wave = [0, 1, 2, 3, 4, 5].map((l) => wave(tp[1] + (l - 2.5) * 1.7));
  S.waveBik = wave(tp[1] - 6.0);
  // where the crops and feathers land (Zevachim 6:5): the ash place east of the ramp
  const bd = el('altar.beit-hadeshen')?.box;
  S.deshenTarget = bd ? [(bd.min[0] + bd.max[0]) / 2, (bd.min[1] + bd.max[1]) / 2, bd.max[2]] : [226.5, 285.5, 16.5];
  const pile = el('altar.maarachah-area')?.params?.piles?.find((p) => p.id === 'great')?.box;
  S.pileY = pile ? [pile.min[1] + 0.8, pile.max[1] - 0.8] : [318.3, 324.7];
  S.pileFaceX = pile ? pile.max[0] + 2.3 : 229.3;

  // ---------------------------------------------------------------- the walking graph
  const N = {};
  const node = (id, X, Y, Z, near = false) => { N[id] = { id, X, Y, Z, near }; };
  // the Moked: kohanim come and go through its gate (Beit HaMoked, their house in the court's north wall — Middot 1:6–8)
  const mg = el('azarah.gate.moked')?.box;
  const mx = mg ? (mg.min[0] + mg.max[0]) / 2 : 210.75;
  node('MOK_X', mx, 404.5, D16);          // inside the hall (vanish)
  node('MOK', mx, 388.0, D16);            // just inside the court
  // the Korban gate and its flight to the chel (Middot 1:5): owners of most-holy offerings come and go
  node('KOR_FOOT', 161.5, 419.6, 0, true);
  node('KOR_HEAD', 161.5, 403.6, D16, true);
  node('KOR_IN', 161.5, 395.5, D16);
  node('NWC', 178.0, 388.5, D16);
  // north of the hooks
  node('N_W', 199.0, 387.5, D16);
  node('N_E', 235.5, 387.5, D16);
  // between the tables and the hooks (the flaying lane), and between the rings and the tables
  node('T_W', 199.5, 378.5, D16);
  node('T_E', 235.0, 378.5, D16);
  node('R_W', 199.5, 370.0, D16);
  node('R_E', 235.0, 370.0, D16);
  // the corridors between the ring columns (X 209, 217, 225) at the rows' half-way lines
  for (const cx of [209, 217, 225]) {
    node(`C${cx}_N`, cx, 370.0, D16);
    for (const y of [349.5, 353.5, 357.5, 361.5, 365.5]) node(`C${cx}_${y}`, cx, y, D16);
    node(`C${cx}_S`, cx, 343.0, D16);
  }
  // north face of the altar (between the yesod and ring row 0)
  node('AN_W', 199.6, 343.0, D16);
  node('AN_E', 235.5, 343.0, D16);
  // Ezrat Kohanim strip east of the altar. South of the waving place the strip is taken by the kohanim eating the
  // most-holy portions (courts-daily: groups at X 235–241, Y 300–310) and the hearth with its cook (X 235–238,
  // Y 293–298): the way south keeps 2 amot off the altar's east face, west of the waving pairs, the eaters and the cook,
  // and reaches the hearth's east side from the south ⚙
  node('E_N', 238.5, 386.0, D16);
  node('E_R', 238.5, 360.0, D16);
  node('E_A', 238.5, 341.0, D16);
  node('E_M', 240.6, 324.0, D16);     // east of the waving places (owners at X 238.2)
  node('E_W', 234.2, 328.0, D16);
  node('E_W2', 234.2, 313.0, D16);
  node('E_W3', 233.6, 299.0, D16);
  node('E_W4', 233.6, 290.8, D16);
  node('E_K', 240.6, 290.8, D16);     // south-east of the hearth: the way to its east side
  node('E_SS', 238.5, 278.0, D16);
  // west face of the altar: along the first tread of the Ulam steps (Z 16.5) and the pavement south of them; south of
  // the steps the corridor bends west, clear of the bird kohanim's places and their cages by the SW corner ⚙
  node('AW_N', 199.55, 339.8, 16.5, true);
  node('AW_S', 199.55, 321.2, 16.5, true);
  node('AW_SS', 199.8, 316.0, D16);   // where the Ulam steps' tread is open (nav: the cheek blocks further west)
  node('AW_SW', 197.8, 306.2, D16);
  // the strip past the SW corner: north of the channel's end, over the slab, and out south of the yesod ramp's landing
  node('SWN', 199.75, 305.85, D16);
  node('SWS', 200.25, 303.0, D16);
  // south of the altar, west of the kevesh (between the channel and the handful's place), and round the kevesh's foot
  node('KW_1', 201.6, 301.0, D16);
  node('KW_2', 201.6, 278.0, D16);
  node('K_SW', 203.6, 272.5, D16);
  node('K_SE', 230.5, 272.5, D16);
  node('K_FE', 221.0, 274.6, D16);
  node('K_FW', 213.0, 274.6, D16);
  // the kevesh: up the east half, down the west half
  node('KE_MID', 221.0, 290.0, K(290));
  node('KE_RS', 223.6, 301.6, K(301.6));      // where the small ramp to the sovev leaves the east face
  node('KE_TOP', 221.0, 306.9, TOP - 0.02, true);
  node('KW_TOP', 213.0, 306.9, TOP - 0.02, true);
  node('KW_SALT', 213.0, 283.5, K(283.5));
  node('KW_RY', 210.6, 292.4, K(292.4));      // where the small ramp to the yesod leaves the west face
  // the small ramp to the sovev (altar.kevesh.ramp-sovev: from [226,302.08,23.47] to [226,306.5,22])
  const rs = el('altar.kevesh.ramp-sovev')?.params;
  const rsZ = (y) => (rs ? rs.from[2] + ((rs.to[2] - rs.from[2]) * (y - rs.from[1])) / (rs.to[1] - rs.from[1]) : 22);
  node('RS_1', 226.0, 302.5, rsZ(302.5));
  node('RS_2', 226.0, 306.3, SOV);
  // the sovev (a 1-amah ledge at +22 round the altar)
  node('SV_SE', 231.5, 307.0, SOV);
  node('SV_NE', 231.5, 336.0, SOV);
  node('SV_NW', 202.5, 336.0, SOV);
  node('SV_SW', 202.5, 307.0, SOV);
  // the small ramp to the yesod (altar.kevesh.ramp-yesod)
  node('RY_1', 208.0, 292.7, 20.6);
  node('RY_2', 208.0, 303.4, 17.05);
  node('RY_Y', 202.6, 304.6, 17.0);
  // the altar top: up on the east, round to the right, down on the west (Zevachim 6:3)
  node('TP_SE', 229.6, 309.6, TOP, true);
  node('TP_E', S.pileFaceX, 321.5, TOP, true);
  node('TP_NE', 229.6, 333.4, TOP, true);
  node('TP_NW', 204.4, 333.4, TOP, true);
  node('TP_W', 204.4, 318.0, TOP, true);
  node('TP_SW', 204.4, 309.4, TOP, true);
  // the south strip, in front of the chambers of salt, hides and rinsing (Middot 5:3)
  node('S_1', 192.0, 296.0, D16);
  node('S_2', 180.0, 278.0, D16);
  node('S_B', 161.5, 277.8, D16);
  node('S_MED', 147.25, 277.6, D16);
  node('S_PAR', 130.25, 277.6, D16);
  node('S_MEL', 85.0, 277.6, D16);
  node('MED_IN', 147.25, 271.5, D16);
  node('PAR_IN', 130.25, 271.0, D16);
  node('MEL_IN', 85.0, 271.0, D16);
  // the Bechorot gate and its flight (Middot 1:4)
  node('BECH_IN', 161.5, 266.5, D16);
  node('BECH_HEAD', 161.5, 257.2, D16, true);
  node('BECH_FOOT', 161.5, 241.4, 0, true);
  // Ezrat Yisrael, Nikanor, the fifteen steps, Ezrat Nashim (Middot 2:5–6)
  node('EY_N', 249.5, 362.0, EY, true);
  node('EY_A', 249.5, 341.0, EY, true);
  node('EY_M', 249.5, 330.5, EY, true);
  node('EY_S', 249.5, 300.0, EY, true);
  node('NIK_W', 253.8, 330.5, EY);
  node('NIK_E', 261.0, 330.5, EY);
  node('LAND', 269.8, 330.5, EY);
  node('STEP_FOOT', 278.6, 330.5, EN, true);
  node('EN_E', 392.5, 330.5, EN);
  node('EN_OUT', 401.0, 330.5, EN, true);
  node('CHEL_FOOT', 408.5, 330.5, 0, true);

  const E = [
    ['MOK_X', 'MOK'], ['MOK', 'N_W'], ['MOK', 'N_E'], ['N_W', 'NWC'], ['NWC', 'KOR_IN'], ['KOR_IN', 'KOR_HEAD'], ['KOR_HEAD', 'KOR_FOOT'],
    ['N_W', 'T_W'], ['N_E', 'T_E'], ['N_E', 'E_N'], ['T_W', 'R_W'], ['T_E', 'R_E'], ['R_W', 'AN_W'], ['R_E', 'E_R'], ['T_E', 'E_N'], ['R_E', 'AN_E'],
    ['NWC', 'T_W'],
    ['R_W', 'C209_N'], ['C209_N', 'C217_N'], ['C217_N', 'C225_N'], ['C225_N', 'R_E'],
    ['AN_W', 'C209_S'], ['C209_S', 'C217_S'], ['C217_S', 'C225_S'], ['C225_S', 'AN_E'],
    ['E_N', 'E_R'], ['E_R', 'E_A'], ['E_A', 'AN_E'], ['E_A', 'E_M'], ['E_A', 'E_W'], ['E_W', 'E_W2'], ['E_W2', 'E_W3'], ['E_W3', 'E_W4'], ['E_W4', 'E_K'],
    ['E_K', 'E_SS'], ['E_SS', 'K_SE'],
    ['AN_W', 'AW_N'], ['AW_N', 'AW_S'], ['AW_S', 'AW_SS'], ['AW_SS', 'AW_SW'], ['AW_SW', 'SWN'], ['SWN', 'SWS'], ['SWS', 'KW_1'], ['KW_1', 'KW_2'], ['KW_2', 'K_SW'],
    ['K_SW', 'K_FW'], ['K_FW', 'K_FE'], ['K_FE', 'K_SE'],
    ['K_FE', 'KE_MID'], ['KE_MID', 'KE_RS'], ['KE_RS', 'KE_TOP'], ['KE_TOP', 'TP_SE'], ['TP_SE', 'TP_E'], ['TP_E', 'TP_NE'], ['TP_NE', 'TP_NW'],
    ['TP_NW', 'TP_W'], ['TP_W', 'TP_SW'], ['TP_SW', 'KW_TOP'], ['KW_TOP', 'KW_RY'], ['KW_RY', 'KW_SALT'], ['KW_SALT', 'K_FW'],
    ['KE_RS', 'RS_1'], ['RS_1', 'RS_2'], ['RS_2', 'SV_SE'], ['SV_SE', 'SV_NE'], ['SV_NE', 'SV_NW'], ['SV_NW', 'SV_SW'],
    ['KW_RY', 'RY_1'], ['RY_1', 'RY_2'], ['RY_2', 'RY_Y'], ['KE_RS', 'KW_RY'],
    ['AW_SW', 'S_1'], ['KW_2', 'S_2'], ['S_1', 'S_2'], ['S_2', 'S_B'], ['S_B', 'S_MED'], ['S_MED', 'S_PAR'], ['S_PAR', 'S_MEL'],
    ['S_MED', 'MED_IN'], ['S_PAR', 'PAR_IN'], ['S_MEL', 'MEL_IN'],
    ['S_B', 'BECH_IN'], ['BECH_IN', 'BECH_HEAD'], ['BECH_HEAD', 'BECH_FOOT'], ['K_SW', 'S_2'],
    ['E_R', 'EY_N'], ['E_A', 'EY_A'], ['E_M', 'EY_M'], ['EY_N', 'EY_A'], ['EY_A', 'EY_M'], ['EY_M', 'EY_S'],
    ['EY_M', 'NIK_W'], ['NIK_W', 'NIK_E'], ['NIK_E', 'LAND'], ['LAND', 'STEP_FOOT'], ['STEP_FOOT', 'EN_E'], ['EN_E', 'EN_OUT'], ['EN_OUT', 'CHEL_FOOT'],
  ];
  // the column corridors, and each to its ends
  for (const cx of [209, 217, 225]) {
    const ys = [349.5, 353.5, 357.5, 361.5, 365.5];
    E.push([`C${cx}_S`, `C${cx}_${ys[0]}`]);
    for (let k = 1; k < ys.length; k++) E.push([`C${cx}_${ys[k - 1]}`, `C${cx}_${ys[k]}`]);
    E.push([`C${cx}_${ys[ys.length - 1]}`, `C${cx}_N`]);
  }
  // the rows: each column corridor joins its neighbours along the half-way lines (between ring rows)
  for (const y of [349.5, 353.5, 357.5, 361.5, 365.5]) {
    E.push([`C209_${y}`, `C217_${y}`], [`C217_${y}`, `C225_${y}`]);
    E.push([`C225_${y}`, 'E_R']);
  }
  // directed edges: the kevesh is climbed on its east half and left by its west half; the sovev's small ramp both ways
  const ONEWAY = new Set(['K_FE>KE_MID', 'KE_MID>KE_RS', 'KE_RS>KE_TOP', 'KE_TOP>TP_SE', 'TP_SE>TP_E', 'TP_E>TP_NE', 'TP_NE>TP_NW', 'TP_NW>TP_W', 'TP_W>TP_SW',
    'TP_SW>KW_TOP', 'KW_TOP>KW_RY', 'KW_RY>KW_SALT', 'KW_SALT>K_FW', 'KE_RS>KW_RY']);
  const adj = new Map();
  const dist = (a, b) => Math.hypot(N[a].X - N[b].X, N[a].Y - N[b].Y) + Math.abs(N[a].Z - N[b].Z) * 0.3;
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, dist(a, b)]); };
  for (const [a, b] of E) {
    if (!N[a] || !N[b]) continue;
    link(a, b);
    if (!ONEWAY.has(`${a}>${b}`)) link(b, a);
  }

  // keep-right: half a shoulder's width to the right on open pavement corridors (0.52 amah = 25 cm)
  const KEEP = 0.52;
  // (not at gates, chamber doors, the ramp's foot, or past the bird kohanim's places and cages by the SW corner)
  const NO_KEEP = new Set(['MOK_X', 'MOK', 'KOR_IN', 'BECH_IN', 'SWN', 'SWS', 'MED_IN', 'PAR_IN', 'MEL_IN', 'K_FE', 'K_FW', 'KW_1', 'AW_SS', 'AW_SW']);
  const KEEP_OK = (n) => !n.near && Math.abs(n.Z - D16) < 1e-3 && !NO_KEEP.has(n.id);
  const spCache = new Map();
  function shortest(from, to) {
    const ck = `${from}>${to}`;
    if (spCache.has(ck)) return spCache.get(ck);
    const r = shortest0(from, to);
    spCache.set(ck, r);
    return r;
  }
  function shortest0(from, to) {
    if (from === to) return [from];
    const d = new Map([[from, 0]]), prev = new Map(), done = new Set();
    const open = [from];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (d.get(open[i]) < d.get(open[bi])) bi = i;
      const u = open.splice(bi, 1)[0];
      if (u === to) break;
      if (done.has(u)) continue;
      done.add(u);
      for (const [v, w] of adj.get(u) || []) {
        const nd = d.get(u) + w;
        if (nd < (d.get(v) ?? Infinity)) { d.set(v, nd); prev.set(v, u); open.push(v); }
      }
    }
    if (!prev.has(to)) return null;
    const out = [to];
    while (out[0] !== from) out.unshift(prev.get(out[0]));
    return out;
  }

  /** nearest graph node to a point (plan distance, preferring the same level) */
  const NL = Object.values(N);
  function nearestNode(p, avoid) {
    let best = null, bd = Infinity;
    const z = p[2] ?? D16;
    for (let i = 0; i < NL.length; i++) {
      const n = NL[i];
      if (avoid?.has(n.id)) continue;
      const dx = n.X - p[0], dy = n.Y - p[1], dz = Math.abs(n.Z - z) * 4;
      const d2 = dx * dx + dy * dy;
      if (d2 + dz * dz + 2 * dz * Math.sqrt(d2) >= bd * bd) continue;
      const d = Math.sqrt(d2) + dz;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  const cache = new Map(), nnCache = new Map();
  function nearestCached(p) {
    const k = `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)},${Math.round((p[2] ?? D16) * 20)}`;
    let n = nnCache.get(k);
    if (n === undefined) { n = nearestNode(p); nnCache.set(k, n); }
    return n;
  }
  /**
   * A route between two places: { path: SitePath, near: Uint8Array per point (stairs etc.), length (m) }.
   * a / b: [X,Y,Z] points or node ids; via: the graph node to join from a and to leave by toward b (default: nearest).
   */
  function route(a, b, { from, to } = {}) {
    const pa = typeof a === 'string' ? [N[a].X, N[a].Y, N[a].Z] : a;
    const pb = typeof b === 'string' ? [N[b].X, N[b].Y, N[b].Z] : b;
    // between the marble tables and the hooks the way out is the corridor north of the tables (T_W / T_E), never a
    // node south of them (a straight leg would cross a table)
    const band = (p) => p[1] > 374.3 && p[1] < 383.5 && p[0] > 200 && p[0] < 235 && Math.abs((p[2] ?? D16) - D16) < 0.5;
    const tb = (p) => (p[0] < 217 ? 'T_W' : 'T_E');
    const na = typeof a === 'string' ? a : (from || (band(pa) ? tb(pa) : nearestCached(pa)));
    const nb = typeof b === 'string' ? b : (to || (band(pb) ? tb(pb) : nearestCached(pb)));
    const key = `${Math.round(pa[0] * 100)},${Math.round(pa[1] * 100)},${Math.round(pa[2] * 100)}|${Math.round(pb[0] * 100)},${Math.round(pb[1] * 100)},${Math.round(pb[2] * 100)}|${na}|${nb}`;
    let r = cache.get(key);
    if (r) return r;
    const ids = shortest(na, nb) || [na, nb];
    const pts = [], near = [], nid = [];
    const push = (p, nr, id = null) => {
      const q = pts[pts.length - 1];
      if (q && Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05 && Math.abs(q[2] - p[2]) < 0.05) { near[near.length - 1] ||= nr; return; }
      pts.push(p); near.push(nr ? 1 : 0); nid.push(id);
    };
    push(pa, typeof a === 'string' ? N[a].near : nearFlag(pa), typeof a === 'string' ? a : null);
    // out of (or into) the band straight across to the corridor, not along the hooks or the tables
    if (typeof a !== 'string' && !from && band(pa)) push([pa[0], 378.5, D16], false);
    for (const id of ids) push([N[id].X, N[id].Y, N[id].Z], N[id].near, id);
    if (typeof b !== 'string' && !to && band(pb)) push([pb[0], 378.5, D16], false);
    push(pb, typeof b === 'string' ? N[b].near : nearFlag(pb), typeof b === 'string' ? b : null);
    // a route that doubles back over its first or last graph node (the point lies beyond it): skip that node
    for (const end of [1, pts.length - 2]) {
      if (pts.length < 3 || end < 1 || end > pts.length - 2) continue;
      const p0 = pts[end - 1], p1 = pts[end], p2 = pts[end + 1];
      const v1 = [p1[0] - p0[0], p1[1] - p0[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      if (dot < -0.2 * Math.hypot(...v1) * Math.hypot(...v2) && !near[end] && Math.abs(p1[2] - p0[2]) < 0.01 && Math.abs(p2[2] - p1[2]) < 0.01) {
        pts.splice(end, 1); near.splice(end, 1); nid.splice(end, 1);
      }
    }
    keepRight(pts, nid);
    const path = new SitePath(pts);
    r = { path, near: Uint8Array.from(near), length: path.length, ids };
    cache.set(key, r);
    return r;
  }
  /**
   * Keep to the right: a route's corridor nodes on the open pavement (the court floor, Z 16 — not the ramps, the sovev,
   * stairs, gates, chamber doors or the strip past the SW corner) move KEEP amot to the right of the way the walker
   * goes, mitred at the turns, so two people meeting on a corridor pass each other a shoulder apart; a route's own
   * start and end stay exact ⚙
   */
  function keepRight(pts, nid) {
    if (pts.length < 3) return;
    const off = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const id = nid[i];
      if (!id || !KEEP_OK(N[id])) { off.push(null); continue; }
      const a = pts[i - 1], p = pts[i], b = pts[i + 1];
      let ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu < 0.3 || lv < 0.3) { off.push(null); continue; }
      ux /= lu; uy /= lu; vx /= lv; vy /= lv;
      // right of (x east, y north) heading (dx, dy) is (dy, -dx); the mitre is the sum of both legs' normals
      let rx = uy + vy, ry = -ux - vx;
      const lr = Math.hypot(rx, ry);
      if (lr < 0.5) { off.push(null); continue; }          // a hairpin: stay on the node
      rx /= lr; ry /= lr;
      const cosHalf = Math.max(0.6, (lr / 2));
      const k = Math.min(KEEP / cosHalf, KEEP * 1.6);
      off.push([rx * k, ry * k]);
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const o = off[i - 1];
      if (o) pts[i] = [pts[i][0] + o[0], pts[i][1] + o[1], pts[i][2]];
    }
  }

  /** points off the graph: stair or ramp heights need the physics; datums do not */
  function nearFlag(p) {
    const z = p[2];
    return !(Math.abs(z - D16) < 1e-3 || Math.abs(z - EY) < 1e-3 || Math.abs(z - EN) < 1e-3 || Math.abs(z - SOV) < 1e-3);
  }

  // ---------------------------------------------------------------- observer spots per kind of place ("Go")
  const V = {
    rings: { at: [240, 365, D16], heading: 250 },
    hooks: { at: [226, 366, D16], heading: 340 },
    ne: { at: [242, 347, D16], heading: 225 },
    sw: { at: [194, 297, D16], heading: 40 },
    // south of the altar's SE corner, 18 amot off (near enough the wall hides the ledge), east of the kevesh's small
    // ramp and west of the hearth: the SE horn and the sovev's south side in view, clear of the kohanim eating by the
    // cooking place (courts-daily: X 235–241, Y 300–310) ⚙
    sovev: { at: [229.8, 288.6, D16], heading: 2 },
    top: { at: [217, 303, 23.7], heading: 0 },
    // from the kevesh's foot, up its length: the carriers going up the east half, the altar's edge (the schedule's
    // altar-limbs view at [231, 292] looks into the ramp's side wall) ⚙
    ramp: { at: [217, 266.5, D16], heading: 0 },
    westRamp: { at: [200, 286, D16], heading: 20 },
    tenufah: { at: [240.5, 334, D16], heading: 195 },
    // south-east of the hearth, off the way to its east side: the frying places and the eaters beyond ⚙
    kitchen: { at: [241.4, 288.4, D16], heading: 338 },
    deshen: { at: [236, 286, D16], heading: 270 },
    korban: { at: [176, 380, D16], heading: 330 },
    bechorot: { at: [176, 284, D16], heading: 240 },
    south: { at: [160, 287, D16], heading: 230 },
    nikanor: { at: [250, 346, EY], heading: 170 },
    ey: { at: [252, 372, EY], heading: 190 },
    en: { at: [292, 338, EN], heading: 255 },
    moked: { at: [222, 380, D16], heading: 330 },
  };

  return { lanes, S, N, route, nearestNode, kevZ: K, V, D16, EY, EN, SOV, TOP };
}

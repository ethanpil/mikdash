// Group G3 (sanctuary & song) places: every spot, way and floor height the G3 staging uses, derived from src/data/site.js
// (ctx.elOpt) with the site's own numbers as fallbacks. Site frame, amot: X east, Y north, Z up.
//
// Floors are ANALYTIC (floorAt): the Ulam's twelve steps, the ramp, the duchan's steps, the fifteen steps, the stone
// before the Menorah, the tables and the ledge of the yesod ramp come from their site profiles, so a walking figure
// never costs a physics query (the per-frame budget is < 0.5 ms for the whole group). Spots marked ⚙ are staging
// choices (docs/decisions/choreo-g3-sanctuary.md).

const C2 = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];

export function places(ctx) {
  if (ctx.__g3places) return ctx.__g3places;
  const el = (id) => ctx.elOpt?.(id) || ctx.site?.elements?.[id] || null;
  const box = (id, fb) => el(id)?.box || fb;
  const AZ = 16, EY = 13.5, EN = 6, HE = 22;

  // ---- the Heichal (Middot 4; site heichal.*)
  const kod = box('heichal.kodesh', { min: [117, 320.5, 22], max: [157, 340.5, 62] });
  const gold = box('heichal.mizbach-hazahav', { min: [131.83, 330, 22], max: [132.83, 331, 24] });
  const menE = el('heichal.menorah');
  const men = menE?.box || { min: [129.33, 323, 22], max: [131.33, 323.5, 25] };
  const stone = menE?.params?.stone?.box || { min: [129.833, 323.75, 22], max: [130.833, 325.25, 23.5] };
  const nLamps = menE?.params?.lamps || 7;
  const nm = menE?.params?.nerMaaravi || { lamp: 1, countFrom: 'east' };
  const nerMaaravi = nm.countFrom === 'west' ? nLamps - 1 - nm.lamp : nm.lamp;
  const gate = box('heichal.gate.great', { min: [157, 325.5, 22], max: [163, 335.5, 42] });
  const taDoor = box('heichal.ta.door-ne', { min: [150, 340.5, 22], max: [153, 347.5, 30] });
  const axisY = ctx.site?.axisY ?? 330.5;
  const sx = C2(stone)[0];
  const heichal = {
    kod, gold, men, stone, nLamps, nerMaaravi, gate, axisY,
    goldC: [...C2(gold), gold.max[2]],
    // before the golden altar, on its east (the incense man faces west) ⚙
    goldEast: [gold.max[0] + 1.3, (gold.min[1] + gold.max[1]) / 2, HE],
    // the Teni set down before him (Tamid 3:9 "set it before him") ⚙
    teniAt: [gold.max[0] + 0.6, gold.min[1] - 0.15, HE],
    // the lamps, east → west (index 0 the easternmost; site heichal.menorah lampOrder)
    lamp: (i) => [men.max[0] - (i * (men.max[0] - men.min[0])) / (nLamps - 1), (men.min[1] + men.max[1]) / 2, men.max[2]],
    // the stone of three steps (Tamid 3:9): its foot (north), its top step, and its second step where the Kuz rests
    stoneFoot: [sx, stone.max[1] + 0.65, HE],
    stoneTop: [sx, stone.min[1] + 0.27, stone.max[2]],
    kuzAt: [sx + 0.35, stone.min[1] + 0.75, stone.min[2] + 1.0],
    // the gate opener's spot (gates.js openerAt) and the ta door into the Kodesh (Tamid 3:7)
    opener: [gate.min[0] - 4, (gate.min[1] + gate.max[1]) / 2, HE],
    taIn: [(taDoor.min[0] + taDoor.max[0]) / 2, taDoor.min[1] - 0.6, HE],
    // the memuneh at the curtain's north edge, in the Ulam, to lift it (Tamid 7:1) ⚙
    curtainMan: [gate.max[0] + 2.3, gate.max[1] + 1.4, HE],
  };

  // ---- the Ulam's steps (Middot 3:6; altar.ulam-steps): treads rising westward, four rovadim
  const se = el('altar.ulam-steps');
  const sb = se?.box || { min: [179, 320.5, 16], max: [201, 340.5, 22] };
  const prof = se?.params?.profile || [[200, 16.5, 1], [199, 17, 1], [198, 17.5, 3], [195, 18, 1], [194, 18.5, 1], [193, 19, 3], [190, 19.5, 1], [189, 20, 1], [188, 20.5, 3], [185, 21, 1], [184, 21.5, 1], [183, 22, 4]].map(([riserX, topZ, tread]) => ({ riserX, topZ, tread }));
  const treads = prof.map((p) => ({ x0: p.riserX - p.tread, x1: p.riserX, z: p.topZ }));
  const stepTop = (X) => {
    if (X >= treads[0].x1) return AZ;
    for (let i = 0; i < treads.length; i++) if (X >= treads[i].x0) return treads[i].z;
    return HE;
  };
  // a soft step: the mean over ±0.3 amah, so a figure climbing rises with its stride, not in jumps
  const stepsZ = (X) => (stepTop(X - 0.3) + stepTop(X - 0.15) + stepTop(X) + stepTop(X + 0.15) + stepTop(X + 0.3)) / 5;
  const rovad = (k) => { const t = treads.filter((q) => q.x1 - q.x0 >= 2.9)[k] || treads[2]; return { X: (t.x0 + t.x1) / 2, Z: t.z }; };
  const steps = { box: sb, treads, rovad, top: { X: (treads[treads.length - 1].x0 + treads[treads.length - 1].x1) / 2 + 0.3, Z: HE }, foot: treads[0].x1 + 0.35 };

  // ---- the altar and the ramp (Middot 3:1–4; altar.*)
  const top = box('altar.top', { min: [203, 307.5, 22], max: [231, 335.5, 25] });
  const walkway = box('altar.walkway', { min: [204, 308.5, 25], max: [230, 334.5, 25.01] });
  const ZT = top.max[2];
  const kv = el('altar.kevesh');
  const kb = kv?.box || { min: [209, 275.5, 16], max: [225, 307.5, 25] };
  const kp = kv?.params || { from: [217, 275.5, 16], to: [217, 307.5, 25] };
  const kevZ = (y) => kp.from[2] + ((kp.to[2] - kp.from[2]) * Math.min(Math.max(y - kp.from[1], 0), kp.to[1] - kp.from[1])) / (kp.to[1] - kp.from[1]);
  const kmid = (kb.min[0] + kb.max[0]) / 2;
  const ramp = { box: kb, kevZ, west: (kb.min[0] + kmid) / 2 - 0.5, east: (kb.max[0] + kmid) / 2 + 0.5, foot: kb.min[1], head: kb.max[1], halfY: (kb.min[1] + kb.max[1]) / 2 };
  const wk = { W: walkway.min[0] + 0.5, E: walkway.max[0] - 0.5, S: walkway.min[1] + 0.5, N: walkway.max[1] - 0.5 };
  const maar = el('altar.maarachah-area')?.params || {};
  const incPile = maar.piles?.find((p) => p.id === 'incense')?.box || { min: [205, 310.5, 25], max: [207, 312.5, 26] };
  const cups = box('altar.libation-cups', { min: [204, 307.5, 25], max: [205, 308.5, 25.5] });
  const niche = box('altar.machtah-niche', { min: [205, 305.5, 16], max: [206, 306.5, 16.5] });
  const ledgeB = el('altar.kevesh.ramp-yesod')?.params?.segments?.[1]?.box || { min: [201, 303.5, 16], max: [209, 305.5, 17] };
  const silver = box('altar.table.silver', { min: [205, 280, 16], max: [206, 282, 17.5] });
  const marble = box('altar.table.marble', { min: [205, 285, 16], max: [206, 287, 17.5] });
  const deshen = box('altar.beit-hadeshen', { min: [225.5, 284.5, 16], max: [227.5, 286.5, 16.5] });
  const nx = C2(niche)[0];
  const cupsC = [...C2(cups), cups.max[2]];
  const altar = {
    top, ZT, wk, ramp, incPile, cupsC, niche, ledgeB, silver, marble, deshen,
    // the SW corner of the walkway, where tamid-morning hands the Kohen Gadol over on Shabbat (g2/tamid.js swAt) ⚙
    pourAt: [wk.W + 0.4, wk.S + 0.6, ZT],
    // where the pourer stands to pour: facing south over the cups (Sukkah 4:9 — the wine's cup by the SW horn), the
    // 'pour' pose's right hand (≈ 0.35 amah right, 0.8 forward) over their centre ⚙
    pourStand: [cupsC[0] + 0.35, cupsC[1] + 0.82, ZT],
    // the segan "on the corner" with the sudarin (Tamid 7:3), beside the pourer, toward the court ⚙
    seganAt: [wk.W + 3.2, wk.S + 0.5, ZT],          // east of the pourer, clear of the incense pile ⚙
    // the wine handed to the Kohen Gadol by the man who brought it up (Shabbat) ⚙
    wineAt: [wk.W + 1.85, wk.S + 0.35, ZT],
    // scooping at the incense pile from the west walkway (Tamid 2:5, 5:5) ⚙
    scoopAt: [wk.W + 0.05, (incPile.min[1] + incPile.max[1]) / 2 + 0.1, ZT],
    // the silver pan's niche, reached stooping from the ledge of the yesod ramp (as terumat-hadeshen does) ⚙
    ledge: [nx, ledgeB.max[1] - 0.55, ledgeB.max[2]],
    belowLedge: [nx, ledgeB.min[1] - 0.6, AZ],
    // the gold pan set on the ledge, under the fire-pan man's hands as he stoops (≈ 0.5 m before his feet) ⚙
    goldOnLedge: [nx - 1.0, ledgeB.max[1] - 0.95, ledgeB.max[2]],
    // the amah's open channel west of the yesod ramp (Middot 3:2; Tamid 5:5 — the spilled coals swept into it)
    amahX: 199.6,
    // the vessels on the silver table (Shekalim 6:4), south → north ⚙
    onSilver: (k) => [C2(silver)[0], silver.min[1] + 0.32 + 0.45 * k, silver.max[2]],
    silverStand: [silver.max[0] + 0.95, C2(silver)[1], AZ],
    marbleTop: (k) => [C2(marble)[0], marble.min[1] + 0.5 + k, marble.max[2]],
    marbleStand: (k) => [marble.max[0] + 0.9, marble.min[1] + 0.5 + k, AZ],
    deshenStand: [deshen.max[0] + 1.1, C2(deshen)[1], AZ],
    // the magrefah's resting place by the SW corner, and where it falls between the Ulam and the altar (Tamid 5:6) ⚙
    magrefahRest: [199.25, 306.6, AZ],
    throwAt: [198.9, 314.4, AZ],
    magrefahLand: [196.3, 314.7, AZ],
  };

  // ---- the duchan (Middot 2:6, REbY; azarah.duchan) and Ezrat Yisrael
  const de = el('azarah.duchan');
  const db = de?.box || { min: [242, 263, 13.5], max: [244, 398, 16] };
  const dprof = de?.params?.profile || [{ x: 244, topZ: 14.5, tread: 1 }, { x: 243, topZ: 15, tread: 0.5 }, { x: 242.5, topZ: 15.5, tread: 0.5 }];
  const duchanTop = (X) => {
    if (X >= dprof[0].x) return EY;
    for (const p of dprof) if (X >= p.x - (typeof p.tread === 'number' ? p.tread : 0.5)) return p.topZ;
    return AZ;
  };
  const duchanZ = (X) => (duchanTop(X - 0.12) + duchanTop(X) + duchanTop(X + 0.12)) / 3;
  const step1X = dprof[0].x - 0.5;                       // the middle of the one-amah step the Levites stand on
  const duchan = { box: db, Z1: dprof[0].topZ, X: step1X, boysX: dprof[0].x + 0.75, efX: db.min[0] - 0.9 };

  // ---- the fifteen steps (Middot 2:5; en.steps15): a half-disc east of Nikanor
  const s15 = el('en.steps15')?.params || { center: [260, 330.5, 6], landingRadius: 10.5, outerRadius: 17.5, rise: 0.5 };
  const c15 = s15.center, r0 = s15.landingRadius, r1 = s15.outerRadius;
  const top15 = (r) => (r <= r0 ? EY : r >= r1 ? EN : EN + 0.5 * (Math.floor((r1 - r) / 0.5) + 1));
  const steps15Z = (X, Y) => { const r = Math.hypot(X - c15[0], Y - c15[1]); return (top15(r - 0.2) + top15(r) + top15(r + 0.2)) / 3; };
  // the music chambers under Ezrat Yisrael, open to Ezrat Nashim (Middot 2:6)
  const mc = el('en.music-chambers')?.params?.rooms || [{ side: 'N', door: { min: [255, 350, 6], max: [260, 354, 12] } }, { side: 'S', door: { min: [255, 307, 6], max: [260, 311, 12] } }];
  const musicDoor = (side) => {
    const r = mc.find((q) => q.side === side) || mc[0];
    const y = (r.door.min[1] + r.door.max[1]) / 2;
    return { inside: [r.door.min[0] + 1.6, y, EN], out: [r.door.max[0] + 1.4, y, EN] };
  };
  const ang = (deg, r) => [c15[0] + Math.cos((deg * Math.PI) / 180) * r, c15[1] + Math.sin((deg * Math.PI) / 180) * r];
  // radial ascents (north-east and south-east) clear of the gatekeepers and of the impure waiting east of the steps ⚙
  const ascent = (deg) => { const a = ang(deg, r1 + 2.2), b = ang(deg, r1 - 0.2), c = ang(deg, r0 - 0.4); return [[a[0], a[1], EN], [b[0], b[1], EN + 0.25], [c[0], c[1], EY]]; };
  const music = { N: musicDoor('N'), S: musicDoor('S'), ascentN: ascent(42), ascentS: ascent(-42) };

  // ---- Ezrat Yisrael: the ma'amad's place north of Pinchas' chamber (azarah.ezrat-yisrael, azarah.chamber.pinchas)
  const eyB = box('azarah.ezrat-yisrael', { min: [244, 263, 13], max: [255, 398, 13.5] });
  const pin = box('azarah.chamber.pinchas', { min: [248, 336.5, 13.5], max: [260, 346.5, 33.5] });
  const kel = box('azarah.chamber.kelim', { min: [244, 391, 13.5], max: [255, 403, 33.5] });
  // the full width of the court (≈ 2.4 m cells: room to prostrate full length — people's 'prostrate' layout) ⚙
  const maamad = { x0: eyB.min[0] + 0.6, x1: eyB.max[0] - 0.4, y0: pin.max[1] + 2.5, y1: kel.min[1] - 4.5, Z: EY };
  const nik = box('azarah.gate.nikanor', { min: [255, 325.5, 13.5], max: [260, 335.5, 33.5] });

  // ---- doors the kohanim come and go by ⚙
  const gz = el('azarah.chamber.gazit');
  const gd = gz?.params?.doors?.find((d) => d.face === 'east') || { x: 88, y: [372, 380] };
  const gy = (gd.y[0] + gd.y[1]) / 2;
  const mh = el('azarah.moked.hall')?.params?.interior || { min: [200.75, 392, 16], max: [220.75, 412, 36] };
  const md = el('azarah.chamber.medichin')?.params?.door || { x: [144.25, 150.25] };
  const mdb = box('azarah.chamber.medichin', { min: [140.25, 263, 16], max: [152.25, 275, 36] });
  const mdx = (md.x[0] + md.x[1]) / 2;
  const doors = {
    gazit: [gz?.box ? gz.box.max[0] + 0.4 : 88.4, gy, AZ],
    moked: [(mh.min[0] + mh.max[0]) / 2, mh.min[1] + 3, AZ],
    medichin: [mdx, mdb.max[1] - 1.6, AZ],
    medichinOut: [mdx, mdb.max[1] + 1.4, AZ],
  };
  // the ways (authored straight legs on open pavement) ⚙
  const apronX = (se?.params?.apron ? (se.params.apron.min[0] + se.params.apron.max[0]) / 2 : 200.5) - 0.15;
  const way = {
    // the Gazit's east door → east along the passage north of the Heichal → down to the apron's north end
    gazitToApron: [[doors.gazit[0] + 10.8, gy + 1, AZ], [156, 383.6, AZ], [181, 384.5, AZ], [197.5, 346, AZ], [apronX, 340.2, AZ]],
    apronN: [apronX, 340.2, AZ], apronS: [apronX, 321, AZ], sw: [199.6, 309.2, AZ],
    // from the altar's SW corner west of the tables to the ramp's foot (clear of the yesod ramp, tables and channel)
    swToFoot: [[200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 279.5, AZ], [207.5, 275.6, AZ]],
    // from the Moked's gate between the dwarf pillars and the marble tables to the apron
    mokedOut: [[209.0, 389.0, AZ], [209.0, 371.0, AZ], [203.2, 347.0, AZ], [apronX - 0.6, 339.6, AZ]],
    // from Lishkat HaMedichin's door north-east to the apron's south end
    medichinOut: [[doors.medichinOut[0], doors.medichinOut[1], AZ], [184.5, 277.5, AZ], [195.8, 301.0, AZ], [197.8, 318.8, AZ]],
    // round the ramp's foot and up Ezrat Kohanim to the duchan, clear of the kitchen ⚙
    footToDuchan: [[207.5, 273.8, AZ], [226.5, 273.8, AZ], [230.5, 282, AZ], [231, 300, AZ], [234.5, 304, AZ], [237.5, 316, AZ], [240.4, 325.5, AZ]],
    eastLine: 236.5,
  };
  // the withdrawal (Yoma 44a): out of the strip between the Ulam and the altar, north of the altar and south-west of it
  const north = [];
  for (const y of [339.6, 342.1, 344.6]) for (const x of [203.6, 206.4, 209.2, 212.0, 214.8, 217.6, 220.4]) north.push([x, y, AZ]);
  const south = [];
  for (const y of [295.6, 298.1, 300.6]) for (const x of [202.4, 204.6]) south.push([x, y, AZ]);
  // the kohanim's prostration in the Kodesh: two blocks either side of the axis (the aisle stays free) ⚙
  const kneel = [];
  for (const x of [153.2, 148.4, 143.6, 138.8]) for (const dy of [-8.3, -5.7, -3.1, 3.1, 5.7, 8.3]) kneel.push([x, axisY + dy, HE]);
  const P = {
    AZ, EY, EN, HE, heichal, steps, stepsZ, altar, ramp, duchan, duchanZ, steps15Z, music, maamad, nik, eyB, doors, way, north, south, kneel, apronX,
    floorAt: null,
  };
  /** the floor at site (X, Y) for a figure whose interpolated height is z — stairs, the ramp, the tables and ledges */
  P.floorAt = (X, Y, z) => {
    if (X >= sb.min[0] && X <= sb.max[0] && Y >= sb.min[1] - 0.2 && Y <= sb.max[1] + 0.2 && z > AZ - 0.4 && z < HE + 0.4) return stepsZ(X);
    if (X >= kb.min[0] && X <= kb.max[0] && Y >= kb.min[1] && Y <= kb.max[1] && z > AZ + 0.2) return kevZ(Y);
    if (X >= top.min[0] && X <= top.max[0] && Y >= top.min[1] && Y <= top.max[1] && z > ZT - 1.2) return ZT;
    if (X >= db.min[0] - 0.3 && X <= db.max[0] + 0.3 && Y >= db.min[1] && Y <= db.max[1] && z > EY - 0.2 && z < AZ + 0.2) return duchanZ(X);
    if (X >= c15[0] - 0.05 && z > EN - 0.2 && z < EY + 0.2) { const r = Math.hypot(X - c15[0], Y - c15[1]); if (r > r0 - 0.4 && r < r1 + 0.4) return steps15Z(X, Y); }
    if (X >= stone.min[0] && X <= stone.max[0] && Y >= stone.min[1] && Y <= stone.max[1] && z > HE - 0.1) {
      const n = 3, run = (stone.max[1] - stone.min[1]) / n, rise = (stone.max[2] - stone.min[2]) / n;
      return stone.min[2] + rise * Math.min(n, Math.max(1, Math.ceil((stone.max[1] - Y) / run)));
    }
    if (X >= marble.min[0] && X <= marble.max[0] && Y >= marble.min[1] && Y <= marble.max[1] && z > AZ + 0.6) return marble.max[2];
    if (X >= ledgeB.min[0] && X <= ledgeB.max[0] && Y >= ledgeB.min[1] && Y <= ledgeB.max[1] && z > AZ + 0.4) return ledgeB.max[2];
    return z;
  };
  ctx.__g3places = P;
  return P;
}

/** up the Ulam's steps at Y from their foot to the top landing and into the Ulam's opening */
export function upSteps(P, y, yIn = y) {
  const s = P.steps;
  return [[s.foot, y, P.AZ], [s.top.X - 0.6, y, P.HE], [s.box.min[0] - 2.5, yIn, P.HE]];
}
/** from the Ulam's opening along the axis through the great gate into the Kodesh */
export function intoKodesh(P, y = P.heichal.axisY) {
  const g = P.heichal.gate, a = P.heichal.axisY;
  return [[g.max[0] + 6, a, P.HE], [g.max[0] + 0.5, a, P.HE], [g.min[0] - 1.5, a, P.HE], [g.min[0] - 3.5, y, P.HE]];
}
/** out of the Kodesh along the axis to the top of the Ulam's steps at Y */
export function outOfKodesh(P, y) {
  const g = P.heichal.gate, a = P.heichal.axisY, s = P.steps;
  return [[g.min[0] - 1.5, a, P.HE], [g.max[0] + 0.5, a, P.HE], [g.max[0] + 6, a, P.HE], [s.box.min[0] - 2.5, y, P.HE], [s.top.X - 0.6, y, P.HE]];
}

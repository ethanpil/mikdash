// Group G2 places: every standing spot and way the dawn-altar and tamid choreos use, derived from src/data/site.js
// (ctx.el) and the builders' anchors (altar.hook.P.R, altar.ring.*), with the numbers of site.js as fallbacks.
// Site frame, amot: X east, Y north, Z up. Spots marked ⚙ are staging choices (logged in docs/decisions/choreo-g2-altar.md).
import { w2m } from '../../../core/units.js';

const C = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];

/** the places, computed once per boot */
export function places(ctx) {
  if (ctx.__g2places) return ctx.__g2places;
  const el = (id) => ctx.elOpt?.(id) || null;
  const box = (id, fb) => el(id)?.box || fb;
  const anchor = (name) => {
    const a = ctx.anchors?.get?.(name);
    if (!a?.pos) return null;
    const p = w2m(a.pos);
    return [p.X ?? p.x ?? p[0], p.Y ?? p.y ?? p[1], p.Z ?? p.z ?? p[2]];
  };
  const Z = 16;   // Azarah pavement

  // ---- the altar, its top and the ramp (Middot 3:1–3; altar.* elements)
  const top = box('altar.top', { min: [203, 307.5, 22], max: [231, 335.5, 25] });
  const walkway = box('altar.walkway', { min: [204, 308.5, 25], max: [230, 334.5, 25.01] });
  const ZT = top.max[2];
  const kv = el('altar.kevesh');
  const kb = kv?.box || { min: [209, 275.5, 16], max: [225, 307.5, 25] };
  const kp = kv?.params || { from: [217, 275.5, 16], to: [217, 307.5, 25] };
  const kevZ = (y) => kp.from[2] + ((kp.to[2] - kp.from[2]) * (y - kp.from[1])) / (kp.to[1] - kp.from[1]);
  const mid = (kb.min[0] + kb.max[0]) / 2;
  const ramp = {
    box: kb, kevZ, mid,
    east: (kb.max[0] + mid) / 2 + 0.5,     // the line walked up: the east half (Zevachim 6:3) ⚙
    west: (kb.min[0] + mid) / 2 - 0.5,     // … and down: the west half
    foot: kb.min[1], head: kb.max[1],
    halfY: (kb.min[1] + kb.max[1]) / 2,    // "from the half of the ramp and below" (Tamid 4:3)
    /** the walking surface's Z at Y on the ramp's line (the pavement before its slope starts) */
    z: (y) => (y <= kp.from[1] ? kp.from[2] : kevZ(Math.min(y, kp.to[1]))),
  };
  const maar = el('altar.maarachah-area')?.params || {};
  const tap = maar.tapuach || { center: [217, 321.5, 25], radius: 4, height: 3 };
  const pile = (id, fb) => maar.piles?.find((p) => p.id === id)?.box || fb;
  const great = pile('great', { min: [221, 317.5, 25], max: [227, 325.5, 27] });
  const incense = pile('incense', { min: [205, 310.5, 25], max: [207, 312.5, 26] });
  const kiyum = pile('kiyum-haesh', { min: [210, 313.5, 25], max: [213, 316.5, 26] });
  const wk = { W: walkway.min[0] + 0.5, E: walkway.max[0] - 0.5, S: walkway.min[1] + 0.5, N: walkway.max[1] - 0.5 };
  const altar = {
    top, ZT, wk, tap, great, incense, kiyum,
    yesod: box('altar.yesod', { min: [201, 305.5, 16], max: [233, 337.5, 17] }),
    body: box('altar.body', { min: [202, 306.5, 16], max: [232, 336.5, 22] }),
    greatFace: [walkway.max[0] - 0.6, C(great)[1], ZT],    // before the great pile, its face east (Tamid 2:4)
    incenseAt: [incense.max[0] + 1.8, incense.max[1] + 1.6, ZT],
  };

  // ---- the kiyor and the muchni (Tamid 1:4; Yoma 37a; altar.kiyor, altar.kiyor.muchni)
  const kp2 = el('altar.kiyor')?.params || { center: [190, 317, 16], diameter: 4 };
  const KC = kp2.center, KR = kp2.diameter / 2;
  const wb = el('altar.kiyor.muchni')?.params?.wheel || { min: [186, 310, 16], max: [194, 314.5, 22] };
  const xT1 = wb.max[0] - 0.45;
  const wheelX = xT1 - 0.16 - 0.25;                       // the hand-wheel's plane, inside the east trestle (kiyor.js)
  const axleY = (wb.min[1] + wb.max[1]) / 2;
  // people's windlass stations (src/people/clips.js WINDLASS / WINDLASS_RAISE, amot): the operator 1.146 amot west of
  // the wheel's plane, facing it (heading 90), 1.5625 amot south of the axle to lower the kiyor (the south rim pulled
  // down) or north of it to raise it (the north rim pulled down)
  const st = { westOfWheel: 1.146, fromAxle: 1.5625 };
  // people's 'kiddush' crouches over the hands on the insteps, the head ≈ 0.4 m before the feet (src/people/clips.js):
  // facing the laver his head would be in its bowl, the spigot at his neck. He stands turned 50° off the radial, his
  // right side to the laver, the outer edge of his right hand and its instep under the nozzle (r 2.3 amot). A capsule
  // check over people's joints at sizes 0.95–1.05 (choreo-adopt-fix): head ≥ 15 cm off the bowl, shoulder ≥ 2 cm off the
  // pipe and nozzle, ≥ 4 cm from the man at the next spigot ⚙ — in the spigot's frame (amot): u out from the axis, v
  // counter-clockwise; the facing is inward turned `turn` degrees counter-clockwise
  const KID = { u: KR * 1.15 + 0.454, v: -0.084, turn: 50 };
  const kiddushAt = (deg) => {
    const a = deg / 57.2958, c = Math.cos(a), s = Math.sin(a);
    const f = (deg + 180 + KID.turn) / 57.2958;
    return { p: [KC[0] + c * KID.u - s * KID.v, KC[1] + s * KID.u + c * KID.v, Z], h: (((90 - f * 57.2958) % 360) + 360) % 360 };
  };
  const kidSpots = [-45, -15, 15, 45, 135, 165, 195, 225].map(kiddushAt);
  const kiyor = {
    c: KC, r: KR, wheel: wb, wheelX, axleY,
    // he works the hand-wheel from inside the frame, beside its plane, hands on the pegs of its lower rim ⚙
    wheelStand: [wheelX - 0.8, axleY - 1.05, Z],
    lowerStand: [wheelX - st.westOfWheel, axleY - st.fromAxle, Z],
    raiseStand: [wheelX - st.westOfWheel, axleY + st.fromAxle, Z],
    // the axle is 2.6 amot up (1.25 m): to reach the north station from the frame's open south side he ducks under it
    underAxle: [[wheelX - st.westOfWheel, axleY - 1.15, Z], [wheelX - st.westOfWheel, axleY + 1.0, Z]],
    // the twelve spigots (Yoma 37a) at 15° + k·30° (world/altar/kiyor.js): each man stands with his right hand and foot
    // under one (people's 'kiddush', Zevachim 19b), turned off the radial as KID above; east/spots are where he stands,
    // eastHeading/spotHeadings the way he faces
    east: kiddushAt(15).p, eastHeading: kiddushAt(15).h,
    // the court is open east and west of the laver (steps to the north, the frame south)
    spots: kidSpots.map((k) => k.p), spotHeadings: kidSpots.map((k) => k.h),
  };

  // ---- the silver pan's niche, Beit HaDeshen, the tables west of the ramp
  const niche = box('altar.machtah-niche', { min: [205, 305.5, 16], max: [206, 306.5, 16.5] });
  const nx = C(niche)[0];
  const lr = el('altar.kevesh.ramp-yesod')?.params?.segments?.[1]?.box || { min: [201, 303.5, 16], max: [209, 305.5, 17] };
  const bd = box('altar.beit-hadeshen', { min: [225.5, 284.5, 16], max: [227.5, 286.5, 16.5] });
  const ts = box('altar.table.silver', { min: [205, 280, 16], max: [206, 282, 17.5] });
  const tm = box('altar.table.marble', { min: [205, 285, 16], max: [206, 287, 17.5] });
  const pan = {
    niche, // he stands on the small yesod ramp's level run (Z 17) and stoops to the pan in the pocket below ⚙
    floor: [nx, lr.min[1] - 0.6, Z], ledge: [nx, lr.max[1] - 0.55, lr.max[2]],
  };
  const deshen = { box: bd, c: [...C(bd), Z], stand: [bd.max[0] + 1.1, C(bd)[1], Z] };
  const tables = { silver: ts, marble: tm, silverStand: [ts.max[0] + 0.9, C(ts)[1], Z], marbleStand: [tm.max[0] + 0.9, C(tm)[1], Z] };

  // ---- the slaughter-house north of the altar (Middot 3:5, 5:2; Tamid 3:5, 4:1–2)
  const rp = el('altar.rings')?.params || { tamidMorning: { ring: [213, 347.5, 16] }, tamidAfternoon: { ring: [221, 347.5, 16] } };
  const nn = el('altar.nanasin')?.params || { pillars: [203, 207, 211, 215, 219, 223, 227, 231].map((x) => [x, 383.75, 16]), hookRowsZ: [19.2, 19.5, 19.8] };
  const hook = (p) => anchor(`altar.hook.${p}.0`) || [nn.pillars[p][0], nn.pillars[p][1] - 0.7, nn.hookRowsZ[0] + 0.02];
  const mt = el('altar.marble-tables')?.params?.tables || [];
  const slaughter = { ringM: rp.tamidMorning.ring, ringA: rp.tamidAfternoon.ring, hook, pillars: nn.pillars, tables: mt };

  // ---- Lishkat HaGazit (Yoma 25a; azarah.chamber.gazit): its east door, the kodesh half
  const gz = el('azarah.chamber.gazit');
  const gd = gz?.params?.doors?.find((d) => d.face === 'east') || { x: 88, y: [372, 380] };
  const gy = (gd.y[0] + gd.y[1]) / 2;
  const kodesh = gz?.params?.kodeshHalf || { min: [65.5, 371, 16], max: [88, 391, 36] };
  // 'inside' = lotteries.js's doorIn (g1 gazitPlaces eastIn + 0.5): where its scenes take our men in and give them back
  const gazit = { door: [gd.x + 1.2, gy, Z], inside: [gd.x - 1.5, gy, Z], kodesh, lottery: gz?.params?.stations?.lottery || [80, 381, 16] };

  // ---- Beit HaMoked: the wicket in its Azarah gate, the hall, the lamb chamber (Tamid 3:3; Middot 1:6–7)
  const pk = el('azarah.gate.moked')?.params?.pishpash?.box || { min: [212.25, 390, 16], max: [214.25, 392, 20] };
  const lc = box('azarah.moked.chamber.lambs', { min: [200.75, 392, 16], max: [205.75, 398, 26] });
  const pkx = C(pk)[0];
  const moked = {
    wicketOut: [pkx, pk.min[1] - 1.6, Z], wicket: [pkx, C(pk)[1], Z], wicketIn: [pkx, pk.max[1] + 1.4, Z],
    // the lamb chamber's splayed corner door faces the hall (moked.js) ⚙
    lambDoor: [lc.max[0] - 0.55, lc.max[1] - 0.5, Z], lambDoorOut: [lc.max[0] + 1.2, lc.max[1] + 0.6, Z],
    lambIn: [lc.max[0] - 1.6, lc.max[1] - 1.7, Z], lambs: lc,
  };

  // ---- Lishkat HaKelim (Tamid 3:4): its south door on Ezrat Yisrael (+13.5)
  const kl = el('azarah.chamber.kelim');
  const klb = kl?.box || { min: [244, 391, 13.5], max: [255, 403, 33.5] };
  const kdx = kl?.params?.door?.x ? (kl.params.door.x[0] + kl.params.door.x[1]) / 2 : 249.5;
  const ZY = kl?.params?.floorZ ?? 13.5;
  const kelim = { door: [kdx, klb.min[1] + 0.3, ZY], out: [kdx, klb.min[1] - 2.2, ZY], in: [kdx, klb.min[1] + 3.5, ZY], ZY };

  // ---- the Water Gate's house, its stair and roof walk (azarah.gate.mayim.house; Yoma 28b)
  const hse = el('azarah.gate.mayim.house');
  const hb = hse?.box || { min: [195.75, 258, 16], max: [225.75, 263, 36] };
  const gmb = box('azarah.gate.mayim', { min: [205.75, 258, 16], max: [215.75, 263, 36] });
  const zr = hse?.params?.roofZ ?? 36;
  const tw = 0.5, sr = (hb.max[1] - hb.min[1]) / 2 - tw - 0.05;
  const sc = [hb.max[0] - tw - sr - 0.05, (hb.min[1] + hb.max[1]) / 2];
  const walkBox = hse?.params?.terraceWalk?.box || { min: [215.75, 261, 36], max: [221.3, 262.6, 36] };
  const water = {
    // the amah's open channel runs south to the gate's threshold on its axis (site.js azarah.amah-channel): keep east of it
    front: [C(gmb)[0] + 2.3, hb.max[1] + 3, Z], passage: [gmb.max[0] - 1.3, sc[1], Z], roomDoor: [gmb.max[0] + 0.25, sc[1], Z],
    stairFoot: [sc[0] - 1.25, sc[1] - 0.75, Z], sc, sr, z0: Z, z1: zr, steps: Math.round((zr - Z) / 0.5), perTurn: 15,
    landing: [sc[0] - 0.9, sc[1] + 0.95, zr], roof: [walkBox.min[0] + 4.5, walkBox.max[1] - 0.4, zr],
    walkBox, below: [C(gmb)[0] + 3.2, hb.max[1] + 5.8, Z],
  };

  // ---- Beit HaChalifot, the Ulam's north wing, "where they store the knives" (Middot 4:7): up the Ulam's steps, in
  // through its open front (Middot 3:7: no doors) and north to the knife niches on the wing's end wall ⚙ (which niche)
  const us = box('altar.ulam-steps', { min: [179, 320.5, 16], max: [201, 340.5, 22] });
  const chw = box('heichal.chalifot.n', { min: [163, 365.5, 22], max: [174, 375.5, 62] });
  const ZH = chw.min[2];
  const nicheX = chw.min[0] + (chw.max[0] - chw.min[0] - 6) / 7 * 5 + 4.5;   // the fifth niche of the lower row (heichal/index.js) ⚙
  const chalifot = { stand: [nicheX, chw.max[1] - 1.2, ZH], niche: [nicheX, chw.max[1], ZH + 2.25], ZH, wing: chw };

  // ---- the ways between them (authored waypoints along open pavement) ⚙
  const apronX = (el('altar.ulam-steps')?.params?.apron ? (el('altar.ulam-steps').params.apron.min[0] + el('altar.ulam-steps').params.apron.max[0]) / 2 : 200.5) - 0.15;
  // west of the ramp: west of the silver and marble tables, round the north end of the amah's open channel (site.js
  // azarah.amah-channel: 1 wide at X 198.5–199.5 from Y 268.5 to 305.5) to the altar's SW corner, S → N ⚙
  const twx = Math.min(ts.min[0], tm.min[0]) - 1.2;
  const westUp = [[206.3, 274.3, Z], [twx, 279.0, Z], [twx, 297.5, Z], [200.3, 301.2, Z], [200.3, 306.4, Z], [199.6, 309.2, Z]];
  // the chavitin makers' chamber door (Middot 1:4) → the court's north → the Gazit's east door (as lotteries.js, but
  // through the lane between the marble tables and the nanasin) ⚙
  const cd = el('azarah.chamber.chavitin')?.params?.door;
  const cdoor = cd ? [cd.x, (cd.y[0] + cd.y[1]) / 2, cd.z?.[0] ?? 13.5] : [248, 319.5, 13.5];
  const nk = box('azarah.gate.nikanor', { min: [255, 325.5, 13.5], max: [260, 335.5, 33.5] });
  const way = {
    westUp, westDown: [...westUp].reverse(),
    toChalifot: [[apronX, us.max[1] - 1.9, Z], [us.max[0] - 0.85, us.max[1] - 1.9, Z], [us.min[0] + 0.4, us.max[1] - 1.9, ZH], [chw.max[0] - 0.9, us.max[1] - 1.9, ZH],
      [chalifot.stand[0] - 0.4, chw.min[1] - 6, ZH], chalifot.stand],
    fromChavitin: [[cdoor[0] + 1.6, cdoor[1], cdoor[2]], [cdoor[0] - 0.8, cdoor[1], cdoor[2]], [cdoor[0] - 6.4, cdoor[1] + 0.6, Z], [236.4, 336, Z], [236.5, 372.5, Z],
      [234.5, 378.8, Z], [181, 384.5, Z], [156, 383.6, Z], [99.2, 377, Z], gazit.door],
    // in through the Nikanor gate (its inner face) and across Ezrat Yisrael to the chavitin chamber's corner ⚙
    fromNikanor: [[nk.min[0] + 0.6, (nk.min[1] + nk.max[1]) / 2, nk.min[2]], [cdoor[0] - 1.4, (nk.min[1] + nk.max[1]) / 2 - 3, cdoor[2]], [cdoor[0] - 1.6, cdoor[1] + 1.5, cdoor[2]]],
    // the Gazit's door → east along the passage north of the Heichal → north of the Ulam block → down to the altar's NW
    gazitToNW: [[gazit.door[0] + 10, gy + 1, Z], [156, 383.6, Z], [181, 384.5, Z], [197.5, 346, Z], [apronX, 340.2, Z]],
    // between the Ulam steps and the altar (the apron), to the altar's SW corner
    apronS: [[apronX, 321, Z], [199.6, 309.2, Z]],
    // the SW corner of the altar → the west foot of the ramp
    swToFootW: [...westUp.slice(0, -1).reverse(), [ramp.west, kb.min[1] - 1.2, Z]],
    footW: [ramp.west, kb.min[1] - 1.2, Z], footE: [ramp.east, kb.min[1] - 1.2, Z],
    // east of the altar along Ezrat Kohanim; south of Y 301 it bends west round a copper vessel the altar builder
    // stands on the line at Y ≈ 294–298 (a floor probe found it) ⚙
    eastLine: 236.5,
    eastBend: [[236.5, 301, Z], [234.5, 297.5, Z]],
  };
  const P = { Z, altar, ramp, kiyor, pan, deshen, tables, slaughter, gazit, moked, kelim, water, way, apronX, chalifot };
  ctx.__g2places = P;
  return P;
}

/** points walked up the ramp's east half from its foot to its head (Z on the ramp) */
export function rampUp(P, x = P.ramp.east) {
  const r = P.ramp;
  return [[x, r.foot + 0.6, r.kevZ(r.foot + 0.6)], [x, r.head - 0.8, r.kevZ(r.head - 0.8)], [x, r.head + 0.6, P.altar.ZT]];
}
/** … down the west half from the top to the floor */
export function rampDown(P, x = P.ramp.west) {
  const r = P.ramp;
  return [[x, r.head + 0.6, P.altar.ZT], [x, r.head - 0.8, r.kevZ(r.head - 0.8)], [x, r.foot + 0.6, r.kevZ(r.foot + 0.6)], [x, r.foot - 1.2, P.Z]];
}
/** a point on the ramp at Y (its surface height) */
export const onRamp = (P, x, y) => [x, y, P.ramp.kevZ(y)];

/** the circuit of the altar's top walkway to the right, from its SE corner: SE → NE → NW → SW (Tamid 7:3; Zevachim 6:3) */
export function circuit(P, from = 'se', to = 'sw') {
  const w = P.altar.wk, Z = P.altar.ZT;
  const C = { se: [w.E, w.S, Z], ne: [w.E, w.N, Z], nw: [w.W, w.N, Z], sw: [w.W, w.S, Z] };
  const order = ['se', 'ne', 'nw', 'sw'];
  const out = [];
  let i = order.indexOf(from);
  for (let n = 0; n < 4; n++) {
    out.push(C[order[i]]);
    if (order[i] === to) break;
    i = (i + 1) % 4;
  }
  return out;
}

/** a helix up the Water Gate's newel stair (first step SW, last step N, counter-clockwise rising) */
export function spiralUp(P, r = 1.15) {
  const W = P.water, n = W.steps, a1 = Math.PI / 2, a0 = a1 - n * (2 * Math.PI / W.perTurn);
  const pts = [];
  const N = Math.ceil((a1 - a0) / 0.35);
  for (let i = 0; i <= N; i++) {
    const k = i / N, a = a0 + (a1 - a0) * k;
    pts.push([W.sc[0] + Math.cos(a) * r, W.sc[1] + Math.sin(a) * r, W.z0 + (W.z1 - W.z0) * k]);
  }
  return pts;
}

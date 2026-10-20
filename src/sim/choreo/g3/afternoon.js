// Group G3 — the afternoon incense and the lighting of the Menorah (Shemot 30:7–8; Yoma 14b–15a, 26a, 44a; Tamid 6:1):
//   ketoret-afternoon  the fire-pan man's coals from the incense pile into the gold pan and onto the golden altar; a new
//                      man (the afternoon lottery) and his friend with the kaf; "Hakter!"; all withdraw from the Heichal
//                      and from between the Ulam and the altar; the incense alone; the people prostrate;
//   menorah-lighting   the Menorah's man goes in and lights the lamps from the western one, left burning since morning.
// The afternoon follows the morning's order (Tamid 4:2–3 for the tamid; the sources narrate the morning): the same
// stations, ways and gestures (morning.js), shorter. On weekdays the morning's fire-pan and Menorah men keep their tasks
// (Yoma 26a); on Shabbat the incoming mishmar serves (Sukkah 56b) — other faces ⚙.
import { Script, headingOf } from './script.js';
import { upSteps, intoKodesh, outOfKodesh } from './places.js';
import { add, win, cue, SRV } from './day.js';
import { CUE_LEAD, PROSTRATE_S } from './plan.js';
import { TEXT as AM, layIncense, stoopPour } from './morning.js';

const PR = PROSTRATE_S / 60;
const WALK = 1.15, RAMP = 0.85, SEED = 0x6737;

export const TEXT = {
  pan: { en: 'The fire-pan man scoops coals from the incense pile for the afternoon incense, as in the morning (Tamid 5:5)', he: 'מַחְתָּה — קְטֹרֶת שֶׁל בֵּין הָעַרְבַּיִם' },
  hakter: { en: '"Hakter!" — the afternoon incense; again all withdraw from between the Ulam and the altar (Yoma 44a; Shemot 30:8)', he: 'הַקְטֵר! — פָּרְשׁוּ הָעָם' },
  burn: { en: 'A new man burns the evening incense on the golden altar; the smoke rises straight (Shemot 30:8; Yoma 26a)', he: 'קְטֹרֶת שֶׁל בֵּין הָעַרְבַּיִם' },
  prost: { en: 'The incense burned, the people fall on their faces in the courts', he: 'הִשְׁתַּחֲוָיָה' },
  light: { en: 'From the western lamp, left burning since morning, he lights the Menorah, to burn from evening until morning (Tamid 6:1; Shemot 27:21)', he: 'שֶׁמִּמֶּנּוּ הָיָה מַדְלִיק אֶת הַמְּנוֹרָה בֵּין הָעַרְבַּיִם' },
};

/** the afternoon into D; m = the morning build (vessel times). Returns { PKA, burn } */
export function buildAfternoon(ctx, P, W, D, m) {
  const H = P.heichal, A = P.altar, R = P.ramp, AZ = P.AZ, HE = P.HE, way = P.way, steps = P.steps;
  const sab = W.shabbat;
  const k0 = W.KA[0], ml0 = W.ML[0], ml1 = W.ML[1];
  const ax = H.axisY, topX = steps.top.X, r2 = steps.rovad(2);
  const fromGazit = [...way.gazitToApron];
  const toGazit = [way.apronN, ...[...way.gazitToApron].reverse().slice(1), P.doors.gazit];
  const tableE = [A.silver.max[0] + 1.0, 0, AZ];
  const toTable = [...fromGazit, way.apronS, way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 284.0, AZ], [207.0, 283.6, AZ]];
  const exitSouth = [[203.4, 279.5, AZ], [196.0, 279.0, AZ], ...[...way.medichinOut].reverse(), P.doors.medichin];
  const hG = headingOf(A.ledge[0], A.ledge[1], A.goldOnLedge[0], A.goldOnLedge[1]);   // from the ledge to the gold pan

  // ---- the fire-pan man (weekday: the morning's — gazit 4; Shabbat: the incoming watch's)
  const pan = sab ? ['servers', SRV.P2] : ['gazit', 4];
  const Pp = Script.from(k0 - 6.6, P.doors.gazit, 90, 'P-pm');
  Pp.walk(toTable, { speed: 1.25 });
  Pp.walk([[tableE[0], A.onSilver(2)[1], AZ]], { speed: 0.8 });
  Pp.act(0.07, { pose: 'bow', phase: [0, 0.4], heading: 270 });
  const tGoldUp = Pp.now();
  Pp.act(0.06, { pose: 'bow', phase: [0.7, 1], props: [null, 'machtah_gold'] });
  Pp.walk([[207.0, 283.6, AZ], [203.4, 284.5, AZ], [203.4, 296.0, AZ], A.belowLedge], { speed: WALK });
  Pp.shift(A.ledge, 0.05, { heading: 0 });
  Pp.act(0.07, { pose: 'bow', phase: [0, 0.4], heading: hG });
  const tGoldLedge = Pp.now();
  Pp.act(0.05, { pose: 'bow', phase: [0.4, 0.42], props: null });
  Pp.act(0.07, { pose: 'bow', phase: [0.42, 0.45], heading: 0 });
  const tSilverOut = Pp.now();
  Pp.act(0.07, { pose: 'bow', phase: [0.7, 1], props: ['machtah_silver', null] });
  Pp.shift(A.belowLedge, 0.05);
  Pp.walk([[203.4, 296.0, AZ], [203.4, 279.5, AZ], [207.5, 275.6, AZ], [R.east, R.foot - 1.5, AZ]], { speed: 1.2 });
  Pp.walk([[R.east, R.foot + 0.6, AZ], [R.east, R.head - 0.8, A.ZT], [R.east, R.head + 0.8, A.ZT]], { speed: RAMP });
  Pp.walk([[A.wk.E, A.wk.S + 0.1, A.ZT], [A.wk.E, A.wk.N, A.ZT], [A.wk.W + 0.1, A.wk.N, A.ZT], A.scoopAt], { speed: 1.1 });
  Pp.act(0.05, { pose: 'stand', heading: 90 });
  Pp.act(0.25, { pose: 'sweep', phase: { cycle: 2.0 }, heading: 90 });
  Pp.act(0.12, { pose: 'bow', phase: [0, 0.45], heading: 90 });
  const tScoop = Pp.now();
  Pp.act(0.08, { pose: 'bow', phase: [0.7, 1] });
  Pp.walk([[A.wk.W + 0.1, A.wk.S, A.ZT], [R.west, R.head + 0.8, A.ZT], [R.west, R.head - 0.8, A.ZT], [R.west, R.foot + 0.6, AZ], [R.west, R.foot - 1.4, AZ],
    [207.5, 275.6, AZ], [203.4, 279.5, AZ], [203.4, 296.0, AZ], A.belowLedge], { speed: RAMP });
  Pp.shift(A.ledge, 0.05, { heading: 270 });
  const { down: tStoop, pour: tPour } = stoopPour(Pp, A);
  if (!sab) {
    Pp.shift(A.belowLedge, 0.05);
    Pp.walk([[203.6, 302.6, AZ]], { speed: 0.8 });
    Pp.act(0.05, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    Pp.shift([A.amahX + 0.7, 302.6, AZ], 0.2, { pose: 'bow', phase: 0.42, heading: 270 });
    Pp.act(0.06, { pose: 'bow', phase: [0.7, 1] });
    Pp.walk([A.belowLedge], { speed: 0.9 });
    Pp.shift(A.ledge, 0.05, { heading: 0 });
  } else {
    Pp.act(0.05, { pose: 'stand', heading: 200 });
    Pp.act(0.22, { pose: 'bow', phase: [0.05, 0.5], heading: 200 });
    Pp.act(0.07, { pose: 'bow', phase: [0.7, 1], heading: 0 });
  }
  Pp.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: 0 });
  const tSilverBack = Pp.now();
  Pp.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  Pp.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: hG });
  const tGoldTaken = Pp.now();
  Pp.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['machtah_gold', null] });
  Pp.shift(A.belowLedge, 0.05, { pose: 'carry' });
  Pp.walkBy(Math.max(Pp.now() + 0.15, k0 + 0.25), [[200.4, 302.0, AZ], way.sw, [197.8, 318.6, AZ], [199.4, 321.6, AZ]], { pose: 'carry_walk' });
  Pp.until(k0 + 0.45, { pose: 'carry', heading: 270, sway: 4, seed: SEED + 1 });
  Pp.walk([...upSteps(P, 322.2, 328.2), ...intoKodesh(P, 330.5), H.goldEast], { speed: 0.95, pose: 'carry_walk' });
  Pp.act(0.05, { pose: 'carry', heading: 270 });
  Pp.act(0.14, { pose: 'pour', phase: [0, 1], heading: 270 });
  const tHeap = Pp.now() - 0.06;
  Pp.act(0.24, { pose: 'sweep', phase: { cycle: 1.7 }, heading: 270 });
  const kP = [138.0, 330.6, HE];
  Pp.walk([kP], { speed: 0.7 });
  Pp.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 200 });
  const tPanDown = Pp.now();
  Pp.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  Pp.act(0.04, { pose: 'stand', heading: 270 });
  Pp.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  Pp.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 200 });
  const tPanUp = Pp.now();
  Pp.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['machtah_gold', null] });
  Pp.walk([[150, 329.0, HE], ...outOfKodesh(P, 324.6), [topX + 1.2, 323.0, HE]], { speed: WALK, pose: 'carry_walk' });
  Pp.act(0.05, { pose: 'carry', heading: 90 });
  add(D, pan[0], pan[1], Pp);
  win(D, 'machtah_gold', m.vessels.machtah_gold, tGoldUp, A.onSilver(2), 90);
  win(D, 'machtah_gold', tGoldLedge, tGoldTaken, A.goldOnLedge, 90);
  win(D, 'machtah_gold', tPanDown, tPanUp, [kP[0] - 0.4, kP[1] - 1.2, HE], 120);
  D.silverOut.push([tSilverOut, tSilverBack]);
  D.glow.push({ t0: tScoop, t1: tStoop, slot: pan, hand: true });
  D.glow.push({ t0: tPour, t1: tGoldTaken, at: [A.goldOnLedge[0], A.goldOnLedge[1], A.goldOnLedge[2] + 0.12] });
  D.glow.push({ t0: tGoldTaken, t1: tHeap, slot: pan, hand: false });
  D.coals.push({ on: tHeap, burn: NaN });
  cue(D, 'pm-pan', tScoop - 0.3, { caption: TEXT.pan, at: [A.scoopAt[0], A.scoopAt[1], A.ZT], range: 34, id: 'pm-coal-pan' });
  cue(D, 'pm-heap', tHeap + 0.02, { caption: AM.heap, at: H.goldEast, range: 26, id: 'pm-heap' });

  // ---- the incense man (the afternoon lottery's new man) and his friend; the memuneh
  const I = Script.from(k0 - 4.6, P.doors.gazit, 90, 'I-pm');
  const F = Script.from(k0 - 4.5, P.doors.gazit, 90, 'F-pm');
  I.walk(toTable, { speed: 1.2 });
  I.walk([[tableE[0], A.onSilver(3)[1], AZ]], { speed: 0.8 });
  I.act(0.07, { pose: 'bow', phase: [0, 0.4], heading: 270 });
  const tKafUp = I.now();
  I.act(0.06, { pose: 'bow', phase: [0.7, 1], props: ['kaf', null] });
  I.walk([[207.0, 283.6, AZ], [203.4, 284.5, AZ], [203.4, 296.0, AZ], [202.4, 299.2, AZ]], { speed: 0.95, pose: 'carry_walk' });
  I.until(tGoldTaken + 0.04, { pose: 'carry', face: A.ledge, sway: 8, seed: SEED + 3 });
  I.walkBy(Math.max(I.now() + 0.15, k0 + 0.3), [[200.6, 302.4, AZ], way.sw, [198.6, 319.4, AZ], [199.4, 323.6, AZ]], { pose: 'carry_walk' });
  F.walk(toTable.map((p, i) => (i > 4 ? [p[0] + 0.8, p[1] + 0.6, p[2]] : p)), { speed: 1.15 });
  F.walk([[204.6, 289.0, AZ], [204.5, 298.6, AZ]], { speed: 0.95 });
  F.until(tGoldTaken + 0.08, { pose: 'stand', face: A.ledge, sway: 10, seed: SEED + 4 });
  F.walkBy(Math.max(F.now() + 0.15, k0 + 0.33), [[201.4, 303.0, AZ], [199.9, 309.6, AZ], [197.2, 318.8, AZ], [195.8, 322.4, AZ]]);
  const t = { enter: k0 + 1.45, give: k0 + 1.95, pour: k0 + 2.19, warn: k0 + 2.35, out: k0 + 2.49, hakter: k0 + 2.8, withdraw: k0 + 2.97, burn: k0 + 3.6 };
  const iAt = H.goldEast, fAt = [H.goldEast[0] + 0.5, H.goldEast[1] + 1.9, HE];
  I.until(t.enter, { pose: 'carry', heading: 270, sway: 4, seed: SEED + 5 });
  I.walk([...upSteps(P, 323.6, 330.2), ...intoKodesh(P, 330.2), iAt], { speed: WALK, pose: 'carry_walk' });
  I.until(t.give, { pose: 'carry', heading: 270 });
  I.act(0.1, { pose: 'carry', face: fAt });
  const tKafDown = layIncense(I, t, iAt, fAt, H);
  const tBurn = t.burn + 0.08;
  I.shift([137.9, 330.2, HE], 0.07, { pose: 'stand', heading: 270 });
  I.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  I.shift([iAt[0] + 1.0, iAt[1] - 0.5, HE], 0.07, { heading: 220 });
  I.act(0.06, { pose: 'bow', phase: [0, 0.42] });
  const tKafUp2 = I.now();
  I.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['kaf', null] });
  const tIOut = I.now();
  I.walk([[150, 329.4, HE], ...outOfKodesh(P, 322.4), [topX - 0.6, 321.6, HE], [steps.foot, 321.2, AZ], [P.apronX, 320.9, AZ], way.sw, [200.6, 302.4, AZ], P.south[4]], { speed: 1.0, pose: 'carry_walk' });
  I.act(0.05, { pose: 'carry', heading: 20 });
  F.until(t.enter + 0.05, { pose: 'stand', heading: 270 });
  F.walk([...upSteps(P, 322.4, 331.4), ...intoKodesh(P, 331.4), fAt], { speed: WALK });
  F.until(t.give + 0.08, { pose: 'stand', face: iAt });
  F.act(0.06, { pose: 'carry', face: iAt, props: ['bazach', null] });
  F.until(t.pour, { pose: 'carry', face: iAt });
  F.act(0.14, { pose: 'pour', phase: [0, 1], face: iAt });
  F.until(t.warn, { pose: 'carry', face: iAt });
  F.act(0.12, { pose: 'point', face: H.goldC });
  F.until(t.out, { pose: 'carry', face: iAt });
  F.walk([[150, 331.8, HE], ...outOfKodesh(P, 325.6), [topX, 325.6, HE]], { speed: WALK, pose: 'carry_walk' });
  F.until(t.withdraw + 0.08, { pose: 'carry', heading: 90 });
  F.walk([[steps.foot, 321.6, AZ], [P.apronX, 320.9, AZ], way.sw, [200.6, 302.4, AZ], P.south[3]], { speed: 1.0, pose: 'carry_walk' });
  F.act(0.05, { pose: 'carry', heading: 20 });
  Pp.until(t.withdraw + 0.03, { pose: 'carry', heading: 90 });
  Pp.walk([[steps.foot, 321.2, AZ], [P.apronX, 320.9, AZ], way.sw, [200.6, 302.4, AZ], P.south[2]], { speed: 1.0, pose: 'carry_walk' });
  Pp.act(0.05, { pose: 'carry', heading: 20 });
  add(D, 'servers', SRV.I2, I);
  add(D, 'servers', SRV.F2, F);
  win(D, 'kaf', m.vessels.kaf, tKafUp, A.onSilver(3), 90);
  win(D, 'kaf', tKafDown, tKafUp2, [iAt[0] - 0.2, iAt[1] - 1.1, HE], 90);
  const Mm = Script.from(k0 - 2.6, P.doors.gazit, 90, 'M-pm');
  Mm.walk([...fromGazit, [200.9, 338.4, AZ]], { speed: WALK });
  Mm.until(t.enter - 0.1, { pose: 'stand', heading: 200, sway: 10, seed: SEED + 6 });
  const uM = [topX + 0.9, 334.6, HE];
  Mm.walk([[steps.foot, 336.0, AZ], uM], { speed: 0.8 });
  Mm.until(t.hakter, { pose: 'stand', heading: 270, sway: 4, seed: SEED + 7 });
  Mm.act(0.12, { pose: 'point', heading: 268 });
  Mm.until(t.withdraw, { pose: 'stand', heading: 270 });
  Mm.walk([[topX + 1.2, 337.0, HE], [steps.foot, 339.6, AZ], P.north[3]], { speed: 1.0 });
  cue(D, 'pm-bazach', t.give + 0.05, { caption: AM.bazach, at: iAt, range: 22, id: 'pm-bazach' });
  cue(D, 'pm-hakter', t.hakter + 0.02, { caption: TEXT.hakter, at: uM, range: 60, id: 'pm-hakter' });
  cue(D, 'pm-burn', tBurn + 0.05, { caption: TEXT.burn, at: iAt, range: 30, id: 'pm-burn' });
  D.incense.push({ t0: tBurn, t1: tBurn + 9, dens: 0.55 });   // above low: see ketoret-morning.js fires()
  D.coals[D.coals.length - 1].burn = tBurn;
  const fOut = t.out + 0.18, iOut = tIOut + 0.22;
  D.curtain.push({ t: fOut - 0.06, f: 1 }, { t: fOut, f: 0.32 }, { t: fOut + 0.08, f: 0.32 }, { t: fOut + 0.14, f: 0 }, { t: iOut - 0.06, f: 0 }, { t: iOut, f: 0.34 }, { t: iOut + 0.1, f: 0.34 }, { t: iOut + 0.2, f: 1 });
  // the people prostrate when he has come out ⚙ (the morning's order: Tamid 7:1)
  const PKA = tIOut + 0.75;
  D.prost.push(PKA);
  D.hush.push([t.withdraw, PKA + 0.1]);
  cue(D, 'pm-prost', PKA, { caption: TEXT.prost, sound: ['crowd-prostrate', null], at: H.goldEast, range: 300, id: 'pm-prostrate', crowd: true });

  // ---- after: the vessels back on the silver table; out by the south chambers
  const back = (S, k, tGo) => {
    S.until(tGo, { pose: 'carry', heading: 20, sway: 5, seed: SEED + 20 + k });
    S.walk([[203.4, 296.0, AZ], [203.4, 284.0, AZ], [207.0, 283.6, AZ], [tableE[0], A.onSilver(k)[1], AZ]], { speed: 1.0, pose: 'carry_walk' });
    S.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 270 });
    const tDown = S.now();
    S.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
    S.walk(exitSouth, { speed: WALK });
    S.hide(S.now() + 0.01);
    return tDown;
  };
  const tGoldBack = back(Pp, 2, PKA + 0.45);
  const tKafBack = back(I, 3, PKA + 0.55);
  F.until(PKA + 0.62, { pose: 'carry', heading: 20, sway: 5, seed: SEED + 30 });
  F.walk([[203.4, 296.0, AZ], [203.4, 284.0, AZ], [207.0, 283.6, AZ], [tableE[0] + 0.6, A.onSilver(3)[1] + 0.6, AZ]], { speed: 1.0, pose: 'carry_walk' });
  F.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 260 });
  F.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  F.walk(exitSouth, { speed: WALK });
  F.hide(F.now() + 0.01);
  win(D, 'machtah_gold', tGoldBack, W.LK[0], A.onSilver(2), 90);
  win(D, 'kaf', tKafBack, W.LK[0], A.onSilver(3), 90);

  // ---- the lighting: the Menorah's man (weekday: the morning's; Shabbat: the incoming watch's) from the western lamp
  const lit = sab ? ['servers', SRV.B2] : ['clearing', 1];
  const B = Script.from(Math.min(ml0 - 3.2, PKA - 0.5), P.doors.gazit, 90, 'B-pm');
  B.walk([...fromGazit.slice(0, -1), [199.8, 345.2, AZ], [205.0, 342.6, AZ], P.north[5]], { speed: WALK });
  B.until(ml0 + 0.15, { pose: 'stand', heading: 250, sway: 8, seed: SEED + 8 });
  B.walk([[P.apronX + 0.4, 339.6, AZ], [steps.foot, 335.0, AZ], ...upSteps(P, 335.0, 331.0).slice(1), ...intoKodesh(P, 330.6), [143, 328.6, HE], H.stoneFoot], { speed: WALK });
  B.shift(H.stoneTop, 0.07, { heading: 180 });
  const nm = H.nerMaaravi;
  B.act(0.06, { pose: 'stand', face: H.lamp(nm) });
  B.act(0.14, { pose: 'point', face: H.lamp(nm) });            // a light taken from the western lamp ⚙
  const order = [];
  for (let d = 1; d < H.nLamps; d++) { if (nm - d >= 0) order.push(nm - d); if (nm + d < H.nLamps) order.push(nm + d); }
  for (const i of order) {
    const L = H.lamp(i);
    B.act(0.05, { pose: 'stand', face: L });
    B.act(0.22, { pose: 'point', face: L });
    D.lampLight[i] = B.now() - 0.08;
  }
  B.act(0.05, { pose: 'stand', heading: 0 });
  B.shift(H.stoneFoot, 0.07, { heading: 0 });
  B.walk([[137.8, 328.4, HE]], { speed: 0.9 });
  B.act(0.05, { pose: 'stand', heading: 270 });
  B.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  B.walk([[150, 331.6, HE], ...outOfKodesh(P, 337.6), [steps.foot, 338.8, AZ], ...toGazit], { speed: WALK });
  B.hide(B.now() + 0.01);
  add(D, lit[0], lit[1], B);
  const tFirst = Math.min(...order.map((i) => D.lampLight[i]));
  cue(D, 'light', Math.max(tFirst, ml0 + CUE_LEAD), { caption: TEXT.light, at: [H.stoneTop[0], H.stoneTop[1] + 3, HE], range: 26, id: 'menorah-lighting' });
  // the memuneh and the incense men leave once the lamps are lit ⚙
  Mm.until(Math.max(PKA + 1.2, ml1 - 1.5), { pose: 'stand', heading: 250, sway: 6, seed: SEED + 9 });
  Mm.walk([[P.apronX + 0.4, 340.0, AZ], ...toGazit.slice(1)], { speed: WALK });
  Mm.hide(Mm.now() + 0.01);
  add(D, 'servers', SRV.M, Mm);
  void ml1;
  return { PKA, burn: tBurn };
}

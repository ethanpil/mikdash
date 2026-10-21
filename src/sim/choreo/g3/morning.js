// Group G3 — the morning in the sanctuary (Tamid 3:9, 5:4–7:2; Yoma 44a), as timelines for every figure:
//   inner-clearing  the inner altar's ash into the Teni, five lamps cleaned (the two eastern left burning), the Teni
//                   left by the altar and the Kuz on the stone's second step (Tamid 3:9);
//   coal-pan        the silver pan from its niche, up the ramp on its east side and round to the incense pile, the
//                   coals scooped, down on the west, poured into the gold pan; the spilled coals swept into the amah
//                   (Shabbat: covered with the psachter); the incense man takes the kaf with the bazach (Tamid 5:4–5);
//   magrefah        thrown between the Ulam and the altar as they arrive; the kohanim come running from the Gazit, the
//                   Moked and the south chambers, the Levites to the duchan (song.js) (Tamid 5:6);
//   into-heichal    up the Ulam's steps, the two clearing men first: the Teni taken, the eastern lamp cleaned and the
//                   western left, the Kuz taken; the coals heaped on the golden altar and spread (Tamid 6:1–2);
//   ketoret         the bazach handed to the friend, the incense poured into his hands, the warning, "Hakter!", the
//                   withdrawal from the Heichal and from between the Ulam and the altar, the incense alone, his
//                   prostration; (Shabbat) the Kohen Gadol held by three, the curtain lifted for him; the brothers go
//                   in and prostrate (Tamid 6:3–7:1);
//   birkat-kohanim  on the Ulam's steps, the five with their vessels to the south, hands above their heads (Tamid 7:2).
// Minutes inside the windows, spots and walking speeds are reconstruction (⚙, docs/decisions/choreo-g3-sanctuary.md).
import { Script, headingOf } from './script.js';
import { upSteps, intoKodesh, outOfKodesh } from './places.js';
import { add, win, cue, SRV } from './day.js';
import { CUE_LEAD, PROSTRATE_S } from './plan.js';
import { rand } from '../../lib/core.js';

const PR = PROSTRATE_S / 60;            // minutes of one prostration
const WALK = 1.15, STROLL = 0.95, CARRY = 0.95, STAIR = 0.8, RAMP = 0.85, RUN = 3.0;   // m/s ⚙
const SEED = 0x6733;

export const TEXT = {
  clearing: { en: 'Inside the Heichal: the ashes of the golden altar are scooped into the Teni; the Menorah\'s lamps are cleaned, the two eastern left burning (Tamid 3:9)', he: 'דִּשּׁוּן מִזְבֵּחַ הַפְּנִימִי וְהַטָּבַת חָמֵשׁ נֵרוֹת' },
  pan: { en: 'With the silver pan he goes up to the top of the altar, clears the coals this way and that, and scoops (Tamid 5:5)', he: 'נָטַל מַחְתַּת הַכֶּסֶף וְעָלָה לְרֹאשׁ הַמִּזְבֵּחַ' },
  spill: { en: 'He empties them into the gold pan; about a kav of coals scatters, and he sweeps them into the amah (Tamid 5:5)', he: 'נִתְפַּזֵּר מִמֶּנָּה כְּקַב גֶּחָלִים, וְהָיָה מְכַבְּדָן לָאַמָּה' },
  spillShabbat: { en: 'He empties them into the gold pan; on Shabbat the scattered coals are covered with the psachter (Tamid 5:5)', he: 'וּבְשַׁבָּת הָיָה כוֹפֶה עֲלֵיהֶן פְּסַכְתֵּר' },
  magrefah: { en: 'Between the Ulam and the altar the magrefah is thrown down — no one in Jerusalem can hear his neighbour. Kohanim run in to prostrate, Levites to sing (Tamid 5:6)', he: 'אֵין אָדָם שׁוֹמֵעַ קוֹל חֲבֵרוֹ בִּירוּשָׁלַיִם מִקּוֹל הַמַּגְרֵפָה' },
  climb: { en: 'They begin to climb the steps of the Ulam; the two who cleared the inner altar and the Menorah go before them (Tamid 6:1)', he: 'הֵחֵלּוּ עוֹלִים בְּמַעֲלוֹת הָאוּלָם' },
  lamp: { en: 'He cleans the eastern lamp and leaves the western burning — from it he will light the Menorah this evening (Tamid 6:1)', he: 'מְדַשֵּׁן אֶת הַמִּזְרָחִי וּמַנִּיחַ אֶת הַמַּעֲרָבִי דוֹלֵק' },
  heap: { en: 'The coals are heaped on the golden altar and spread with the rim of the pan; he prostrates and goes out (Tamid 6:2)', he: 'צָבַר אֶת הַגֶּחָלִים … וְרִדְּדָן בְּשׁוּלֵי הַמַּחְתָּה' },
  bazach: { en: 'The incense man takes the bazach out of the kaf and gives it to his friend, who pours the incense into his hands (Tamid 6:3)', he: 'נוֹטֵל אֶת הַבָּזָךְ מִתּוֹךְ הַכַּף וְנוֹתְנוֹ לְאוֹהֲבוֹ' },
  warn: { en: '"Take care not to begin in front of you, lest you be burned" (Tamid 6:3)', he: 'הֱוֵי זָהִיר שֶׁמָּא תַתְחִיל לְפָנֶיךָ, שֶׁלֹּא תִכָּוֶה' },
  hakter: { en: '"Hakter!" — "Burn!" The people withdraw from the Heichal and from between the Ulam and the altar (Tamid 6:3; Yoma 44a)', he: 'הַקְטֵר! — פָּרְשׁוּ הָעָם' },
  burn: { en: 'Alone before the golden altar he lays the incense on the coals; its smoke rises straight (Tamid 6:3; Avot 5:5)', he: 'וְהִקְטִיר וְהִשְׁתַּחֲוָה וְיָצָא' },
  kg: { en: 'The Kohen Gadol goes in to prostrate; three hold him — at his right, at his left, and by the precious stones (Tamid 7:1)', he: 'שְׁלֹשָׁה אוֹחֲזִין בּוֹ' },
  lift: { en: 'Hearing his footsteps as he comes out, the officer lifts the curtain for him (Tamid 7:1)', he: 'הִגְבִּיהַּ לוֹ אֶת הַפָּרֹכֶת' },
  brothers: { en: 'His brothers the kohanim go in, prostrate and come out; in the courts the people fall on their faces (Tamid 7:1)', he: 'וְנִכְנְסוּ אֶחָיו הַכֹּהֲנִים וְהִשְׁתַּחֲווּ וְיָצָאוּ' },
  bless: { en: '"May the Lord bless you and keep you; may the Lord make His face shine upon you…" — one blessing, the Name said as it is written, hands raised above their heads (Tamid 7:2)', he: 'יְבָרֶכְךָ ה׳ וְיִשְׁמְרֶךָ…' },
  respond: { en: '"Blessed be the Name of His glorious kingdom for ever and ever" — in the Mikdash the people answer so, not Amen, and fall on their faces (Taanit 16b)', he: 'בָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד' },
};

/**
 * "He came down and emptied them into the gold one" (Tamid 5:5): stooping over the gold pan on the ledge, the silver pan
 * low over it ⚙ (no bent-pour pose: the bow's stoop). Returns { down: the stoop begins, pour: the coals fall }.
 */
export function stoopPour(S, A) {
  // "he emptied them into the gold one" (Tamid 5:5), bent to the pan on the ledge: people's pour_low — the fist comes
  // 0.13 m right of him and 0.5 m ahead, so he turns ≈ 15° left of the gold pan; the silver pan tipped over its lip
  const h = (headingOf(A.ledge[0], A.ledge[1], A.goldOnLedge[0], A.goldOnLedge[1]) + 345) % 360;
  const down = S.now();
  S.act(0.04, { pose: 'pour_low', phase: [0, 0.3], heading: h });
  S.act(0.05, { pose: 'pour_low', phase: [0.3, 0.55], heading: h });
  const pour = S.now() - 0.03;
  S.act(0.03, { pose: 'pour_low', phase: [0.55, 0.62], heading: h });
  S.act(0.05, { pose: 'pour_low', phase: [0.62, 1], heading: h });
  return { down, pour };
}

/**
 * The incense man from the moment he has given the bazach to his friend (Tamid 6:3): the empty kaf set down beside the
 * golden altar, "he gives it to him in his hands" — both palms cupped while the friend pours, held so through the warning,
 * "Hakter!" and the withdrawal; then a step to the altar and the incense laid on the coals from his cupped hands, moving
 * them to and fro over the altar ('wave' to-and-fro half; a stand-in for a spreading gesture) ⚙. t = { pour, burn }.
 * Returns when the kaf was set down (it stays there until he takes it up after his prostration).
 */
export function layIncense(S, t, at, friend, H) {
  S.act(0.05, { pose: 'bow', phase: [0, 0.4], heading: 220 });
  const tKafDown = S.now();
  S.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  S.until(t.pour, { pose: 'stand', face: friend });
  S.act(0.16, { pose: 'wave', phase: 0, face: friend });
  S.until(t.burn - 0.06, { pose: 'wave', phase: 0, heading: 270 });
  const near = [H.gold.max[0] + 0.6, (H.gold.min[1] + H.gold.max[1]) / 2, at[2]];
  S.shift(near, 0.04, { pose: 'wave', phase: 0, heading: 270 });
  for (let k = 0; k < 4; k++) S.act(2.6 / 60, { pose: 'wave', phase: [0, 0.5], heading: 270 });
  S.act(0.04, { pose: 'stand', heading: 270 });
  S.shift(at, 0.05, { heading: 270 });
  return tKafDown;
}

/**
 * Build the morning into D (see day.js). P = places, W = windows. Returns the moments other builders need:
 * { mg, PB, bless: [t0, t1], aisle } .
 */
export function buildMorning(ctx, P, W, D) {
  const H = P.heichal, A = P.altar, R = P.ramp, AZ = P.AZ, HE = P.HE, way = P.way, steps = P.steps;
  const sab = W.shabbat;
  const ic0 = W.IC[0], gg0 = W.GG[0], tl1 = W.TL[1], cp0 = W.CP[0];
  const mg = W.MG[0] + CUE_LEAD;
  const ih0 = W.IH[0], k0 = W.K[0], bk0 = W.BK[0], bk1 = W.BK[1], lu0 = W.LU[0];
  const LK0 = W.LK[0];
  const ax = H.axisY;
  const r0 = steps.rovad(0), r1 = steps.rovad(1), r2 = steps.rovad(2);
  const topX = steps.top.X;
  const toGazit = [way.apronN, ...[...way.gazitToApron].reverse().slice(1), P.doors.gazit];
  const fromGazit = [...way.gazitToApron];
  const downAt = (y) => [[topX - 0.6, y, HE], [steps.foot, y, AZ]];
  const lampAt = (i) => H.lamp(i);
  const nearH = [140, ax, HE], nearSW = [204, 304, AZ], nearSteps = [192, ax, 18];
  const hG = headingOf(A.ledge[0], A.ledge[1], A.goldOnLedge[0], A.goldOnLedge[1]);   // from the ledge to the gold pan

  // ------------------------------------------------------------------------------------------------ 1. inner clearing
  // B (the Menorah's man) comes in from the north ta while the great gate is opened from within (gates.js); A (the inner
  // altar's man) is the gate's opener and turns from it as the clearing begins (Tamid 3:7–9)
  const B1 = Script.from(gg0 - 0.22, H.taIn, 180, 'B-clear', ['kuz', null]);
  B1.walk([[152.8, 333.6, HE]], { speed: 0.8 });
  B1.until(ic0, { pose: 'stand', heading: 95, sway: 6, seed: 11 });
  B1.walk([H.stoneFoot], { speed: 1.0 });
  B1.shift(H.stoneTop, 0.07, { heading: 180 });
  // each lamp dressed (Tamid 3:9): the old wick and oil out, a new wick — people's tend_lamp, his right hand at the lamp's
  // mouth, the kuz in his left; the lamps are dark by morning (lit in the afternoon — world-3), so no flame in his hand
  for (const i of [6, 5, 4, 3, 2]) {
    const L = lampAt(i);
    B1.act(0.06, { pose: 'stand', face: L, props: [null, 'kuz'] });
    B1.act(0.3, { pose: 'tend_lamp', phase: { cycle: 1 / 0.3, off: rand(SEED, 'lp', i) }, face: L });
    D.lampOut[i] = B1.now() - 0.12;
  }
  B1.act(0.06, { pose: 'stand', heading: 0 });
  B1.act(0.1, { pose: 'bow', phase: [0, 0.4] });
  const tKuzDown = B1.now();
  B1.act(0.08, { pose: 'bow', phase: [0.7, 1], props: null });
  B1.shift(H.stoneFoot, 0.07, { heading: 0 });
  B1.walk([[146, 334.8, HE], ...outOfKodesh(P, 337.6), ...downAt(337.6).slice(1), ...toGazit], { speed: WALK });
  B1.hide(B1.now() + 0.01);
  add(D, 'clearing', 1, B1);

  const A1 = Script.from(ic0, H.opener, 90, 'A-clear', ['keys', null]);
  A1.act(0.07, { pose: 'stand', heading: 270, props: ['teni', null] });
  A1.walk([H.goldEast], { speed: 1.0 });
  A1.act(0.1, { pose: 'bow', phase: [0, 0.4], heading: 270 });
  const tTeniDown = A1.now();
  A1.act(0.07, { pose: 'bow', phase: [0.7, 1], props: null });
  A1.act(1.4, { pose: 'kemitzah', phase: { cycle: 3.1 }, heading: 270 });
  A1.act(0.06, { pose: 'bow', phase: [0, 0.45] });
  A1.act(0.26, { pose: 'bow', phase: 0.45 });       // the last of it swept into the Teni ⚙
  A1.act(0.08, { pose: 'bow', phase: [0.7, 1] });
  A1.walk([[150, 329.2, HE], ...outOfKodesh(P, 336.2), ...downAt(336.2).slice(1), ...toGazit], { speed: WALK });
  A1.hide(A1.now() + 0.01);
  add(D, 'clearing', 0, A1);
  cue(D, 'ic', ic0 + 0.6, { caption: TEXT.clearing, at: nearH, range: 32, id: 'inner-clearing' });

  // ------------------------------------------------------------------------------------------------ 2. coal-pan
  // the lottery's winners come out of the Gazit's east door (lotteries.js: incense 3, pan 4 of its circle) ⚙
  const tableE = [A.silver.max[0] + 1.0, A.silver.min[1] + 1.3, AZ];
  const toTable = [...fromGazit, way.apronS, way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 284.0, AZ], [207.0, 283.6, AZ]];
  const P1 = Script.from(tl1 - 0.42, P.doors.gazit, 90, 'P-pan');
  P1.walk(toTable, { speed: 1.25 });
  P1.walk([[tableE[0], A.onSilver(2)[1], AZ]], { speed: 0.8 });
  P1.act(0.07, { pose: 'bow', phase: [0, 0.4], heading: 270 });
  const tGoldUp = P1.now();
  P1.act(0.06, { pose: 'bow', phase: [0.7, 1], props: [null, 'machtah_gold'] });
  P1.walk([[207.0, 283.6, AZ], [203.4, 284.5, AZ], [203.4, 296.0, AZ], A.belowLedge], { speed: WALK });
  P1.shift(A.ledge, 0.05, { heading: 0 });
  P1.act(0.07, { pose: 'bow', phase: [0, 0.4], heading: hG });
  const tGoldLedge = P1.now();
  P1.act(0.05, { pose: 'bow', phase: [0.4, 0.42], props: null });
  P1.act(0.07, { pose: 'bow', phase: [0.42, 0.45], heading: 0 });
  const tSilverOut = P1.now();
  P1.act(0.07, { pose: 'bow', phase: [0.7, 1], props: ['machtah_silver', null] });
  P1.shift(A.belowLedge, 0.05);
  P1.walk([[203.4, 296.0, AZ], [203.4, 279.5, AZ], [207.5, 275.6, AZ], [R.east, R.foot - 1.5, AZ]], { speed: 1.2 });
  // up on the east of the ramp and round the altar to the right — SE, NE, NW — to the incense pile at the SW (Zevachim 6:3)
  P1.walk([[R.east, R.foot + 0.6, AZ], [R.east, R.head - 0.8, A.ZT], [R.east, R.head + 0.8, A.ZT]], { speed: RAMP });
  P1.walk([[A.wk.E, A.wk.S + 0.1, A.ZT], [A.wk.E, A.wk.N, A.ZT], [A.wk.W + 0.1, A.wk.N, A.ZT], A.scoopAt], { speed: 1.1 });
  P1.act(0.05, { pose: 'stand', heading: 90 });
  P1.act(0.3, { pose: 'sweep', phase: { cycle: 2.0 }, heading: 90 });
  P1.act(0.13, { pose: 'bow', phase: [0, 0.45], heading: 90 });
  const tScoop = P1.now();
  P1.act(0.08, { pose: 'bow', phase: [0.7, 1] });
  P1.walk([[A.wk.W + 0.1, A.wk.S, A.ZT], [R.west, R.head + 0.8, A.ZT], [R.west, R.head - 0.8, A.ZT], [R.west, R.foot + 0.6, AZ], [R.west, R.foot - 1.4, AZ],
    [207.5, 275.6, AZ], [203.4, 279.5, AZ], [203.4, 296.0, AZ], A.belowLedge], { speed: RAMP });
  P1.shift(A.ledge, 0.05, { heading: 270 });
  const { down: tStoop, pour: tPour } = stoopPour(P1, A);
  if (!sab) {
    // the scattered coals swept west into the amah's open channel (Tamid 5:5) ⚙
    P1.shift(A.belowLedge, 0.05);
    P1.walk([[203.6, 302.6, AZ]], { speed: 0.8 });
    P1.act(0.05, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    P1.shift([A.amahX + 0.7, 302.6, AZ], 0.22, { pose: 'bow', phase: 0.42, heading: 270 });
    P1.act(0.06, { pose: 'bow', phase: [0.7, 1] });
    P1.walk([A.belowLedge], { speed: 0.9 });
    P1.shift(A.ledge, 0.05, { heading: 0 });
  } else {
    // "on Shabbat he would turn the psachter over them" (Tamid 5:5): down from the ledge to the great copper vessel kept
    // below it ⚙, turned mouth down over the coals that fell there (people's psachter → psachter_inverted), back up
    const ps = A.psachter;
    P1.shift(A.belowLedge, 0.05);
    P1.walk([[ps[0] + 0.9, ps[1] + 0.35, AZ]], { speed: 0.8 });
    P1.act(0.05, { pose: 'bow', phase: [0, 0.45], face: ps });
    const tTurn = P1.now() + 0.05;
    P1.act(0.14, { pose: 'bow', phase: 0.48, face: ps });
    P1.act(0.07, { pose: 'bow', phase: [0.7, 1], face: ps });
    P1.walk([A.belowLedge], { speed: 0.9 });
    P1.shift(A.ledge, 0.05, { heading: 0 });
    win(D, 'psachter', cp0 - 1, tTurn, ps, 75);
    win(D, 'psachter_inverted', tTurn, LK0, ps, 75);
  }
  P1.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: 0 });
  const tSilverBack = P1.now();
  P1.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  P1.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: hG });
  const tGoldTaken = P1.now();
  P1.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['machtah_gold', null] });
  P1.shift(A.belowLedge, 0.05, { pose: 'carry' });
  const gP = [199.4, 321.6, AZ];
  P1.walkBy(Math.max(P1.now() + 0.12, mg - 0.12), [[200.4, 302.0, AZ], way.sw, [197.8, 318.6, AZ], gP], { pose: 'carry_walk' });
  add(D, 'gazit', 4, P1);
  win(D, 'machtah_gold', W.VS[1], tGoldUp, A.onSilver(2), 90);
  win(D, 'machtah_gold', tGoldLedge, tGoldTaken, A.goldOnLedge, 90);
  D.silverOut.push([tSilverOut, tSilverBack]);
  D.glow.push({ t0: tScoop, t1: tStoop, slot: ['gazit', 4], hand: true });
  D.glow.push({ t0: tPour, t1: tGoldTaken, at: [A.goldOnLedge[0], A.goldOnLedge[1], A.goldOnLedge[2] + 0.12] });
  cue(D, 'pan', Math.max(cp0 + CUE_LEAD, tScoop - 0.35), { caption: TEXT.pan, at: [A.scoopAt[0], A.scoopAt[1], A.ZT], range: 34, id: 'coal-pan' });
  cue(D, 'spill', tPour + 0.05, { caption: sab ? TEXT.spillShabbat : TEXT.spill, at: nearSW, range: 30, id: 'coal-pan-spill' });

  // the incense man and his friend: the kaf, with the bazach in it, from the silver table (Tamid 5:4) ⚙
  const I1 = Script.from(tl1 - 0.46, P.doors.gazit, 90, 'I');
  const F1 = Script.from(tl1 - 0.36, P.doors.gazit, 90, 'F');
  I1.walk(toTable, { speed: 1.25 });
  I1.walk([[tableE[0], A.onSilver(3)[1], AZ]], { speed: 0.8 });
  I1.act(0.07, { pose: 'bow', phase: [0, 0.4], heading: 270 });
  const tKafUp = I1.now();
  // the kaf with the bazach full of incense in it, its cover and the cloth over it (Tamid 5:4 — people's kaf_covered),
  // carried by its handle in one hand
  I1.act(0.06, { pose: 'bow', phase: [0.7, 1], props: ['kaf_covered', null] });
  I1.walk([[207.0, 283.6, AZ], [203.4, 284.5, AZ], [203.4, 296.0, AZ], [202.4, 299.2, AZ]], { speed: STROLL, pose: 'walk' });
  I1.until(tGoldTaken + 0.04, { pose: 'stand', face: A.ledge, sway: 8, seed: SEED + 3 });
  const gI = [199.4, 323.6, AZ];
  I1.walkBy(mg - 0.08, [[200.6, 302.4, AZ], way.sw, [198.6, 319.4, AZ], gI], { pose: 'walk' });
  F1.walk(toTable.map((p, i) => (i > 4 ? [p[0] + 0.8, p[1] + 0.6, p[2]] : p)), { speed: 1.2 });
  F1.walk([[204.6, 289.0, AZ], [204.5, 298.6, AZ]], { speed: STROLL });
  F1.until(tGoldTaken + 0.08, { pose: 'stand', face: A.ledge, sway: 10, seed: SEED + 4 });
  const gF = [195.8, 322.4, AZ];
  F1.walkBy(mg - 0.05, [[201.4, 303.0, AZ], [199.9, 309.6, AZ], [197.2, 318.8, AZ], gF]);
  add(D, 'gazit', 3, I1);
  add(D, 'servers', SRV.F, F1);
  win(D, 'kaf_covered', W.VS[1], tKafUp, A.onSilver(3), 90);

  // ------------------------------------------------------------------------------------------------ 3. the magrefah
  // A comes back from the Gazit; as the others arrive he takes up the magrefah and throws it down (Tamid 5:6) ⚙
  const A2 = Script.from(tl1 - 0.25, P.doors.gazit, 90, 'A');
  A2.walk([...fromGazit, way.apronS, [198.8, 318.6, AZ]], { speed: WALK });
  A2.until(mg - 0.32, { pose: 'stand', face: A.ledge, sway: 10, seed: SEED + 5 });
  A2.walk([[A.magrefahRest[0] + 0.35, A.magrefahRest[1] + 0.95, AZ]], { speed: 1.0 });
  A2.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: 190 });
  const tMagUp = A2.now();
  A2.act(0.06, { pose: 'bow', phase: [0.7, 1], props: ['magrefah', null] });
  A2.walkBy(mg - 0.06, [A.throwAt], { speed: 1.0 });
  A2.act(0.02, { pose: 'throw', phase: [0, 0.38], heading: 268 });
  A2.act(0.02, { pose: 'throw', phase: [0.38, 0.55] });
  A2.act(0.035, { pose: 'throw', phase: [0.55, 1], props: null });
  A2.act(0.04, { pose: 'stand' });
  const gA = [197.4, 321.4, AZ];
  A2.walk([gA], { speed: 0.9 });
  add(D, 'clearing', 0, A2);
  win(D, 'magrefah', cp0 - 0.3, tMagUp, A.magrefahRest, 180);
  cue(D, 'magrefah', mg, { sound: ['magrefah', [A.magrefahLand[0], A.magrefahLand[1], AZ + 0.2]], caption: TEXT.magrefah, at: A.magrefahLand, range: 220, id: 'magrefah' });

  const B2 = Script.from(tl1 - 0.2, P.doors.gazit, 90, 'B');
  const gB = [197.4, 323.4, AZ];
  B2.walk([...fromGazit, way.apronS, [198.2, 322.0, AZ], gB], { speed: WALK });
  add(D, 'clearing', 1, B2);

  // the memuneh (the officer of Tamid 5:1–6:3) ⚙ by the north end of the steps, then with them
  const M1 = Script.from(tl1 + 0.35, P.doors.gazit, 90, 'M');
  M1.walk([...fromGazit, [200.9, 338.4, AZ]], { speed: WALK });
  M1.until(mg + 0.05, { pose: 'stand', heading: 200, sway: 12, seed: SEED + 6 });
  const gM = [195.6, 325.4, AZ];
  M1.walk([[199.6, 334.0, AZ], gM], { speed: 1.0 });

  // the brothers: nine come out of the Gazit after the lottery and stand about east of it; five rest in Beit HaMoked's
  // hall and four in the chambers on the south side; at the crash they all run in (Tamid 5:6) ⚙
  const gSpots = [];
  for (const y of [327.0, 329.4, 331.8, 334.2, 336.6, 339.0]) for (const x of [199.2, 196.8, 194.4]) gSpots.push([x, y, AZ]);
  // the Medichin four take the southern spots, those from the north the northern ones
  const southSpots = gSpots.filter((s) => s[1] < 330);
  const northSpots = gSpots.filter((s) => s[1] >= 330);
  const gOf = {};
  [13, 14, 15, 16].forEach((k, j) => { gOf[k] = southSpots[j]; });
  [0, 1, 2, 3, 4, 5, 6, 7, 17, 8, 9, 10, 11, 12].forEach((k, j) => { gOf[k] = northSpots[j] || southSpots[4 + j - northSpots.length]; });
  const idle = [[101.6, 382.4], [103.8, 384.6], [105.6, 381.6], [103.2, 380.0], [117.2, 372.8], [119.6, 374.6], [121.4, 371.6], [118.6, 369.6], [123.0, 373.9]];
  const idleC = [[103.6, 382.2], [120.2, 372.4]];
  const BR = [];
  for (let k = 0; k < 18; k++) {
    const react = 0.012 + 0.07 * rand(SEED, 'react', k);
    let S;
    if (k <= 7 || k === 17) {
      const j = k === 17 ? 8 : k;
      S = Script.from(tl1 - 0.12 + 0.13 * j, P.doors.gazit, 90, `g${k}`);
      const sp = idle[j], c = idleC[j < 4 ? 0 : 1];
      S.walk([[P.doors.gazit[0] + 3, P.doors.gazit[1] + (j % 2 ? 1 : -1), AZ], [sp[0], sp[1], AZ]], { speed: 0.9 + 0.15 * rand(SEED, 'sv', k) });
      S.until(mg + react, { pose: 'stand', face: c, sway: 14, seed: SEED + 20 + k });
      S.walk([[sp[0] + 4, sp[1] + 1.5, AZ], [156, 383.6, AZ], [181, 384.5, AZ], [197.5, 346, AZ], [199.6, 339.6, AZ], gOf[k]], { speed: RUN, pose: 'run' });
    } else if (k <= 12) {
      const j = k - 8;
      S = Script.from(mg - 2, P.doors.moked, 180, `g${k}`);
      S.hide(mg + 0.02 + react, [P.doors.moked[0] + (j - 2) * 1.2, P.doors.moked[1] + 1.5, AZ], 180);
      S.walk([...way.mokedOut.map((p, i) => (i < 2 ? [p[0] + (j % 2) * 0.9, p[1], p[2]] : p)), gOf[k]], { speed: RUN - 0.2, pose: 'run' });
    } else {
      const j = k - 13;
      S = Script.from(mg - 2, P.doors.medichin, 0, `g${k}`);
      S.hide(mg + 0.03 + react, [P.doors.medichin[0] + (j - 1.5) * 1.1, P.doors.medichin[1], AZ], 0);
      S.walk([...way.medichinOut.map((p, i) => [p[0] + (i ? (j - 1.5) * 0.7 : 0), p[1], p[2]]), gOf[k]], { speed: RUN - 0.3, pose: 'run' });
    }
    S.act(0.05, { pose: 'stand', heading: 270 });
    BR.push(S);
    add(D, 'brothers', k, S);
  }

  // ------------------------------------------------------------------------------------------------ 4. into the Heichal
  cue(D, 'climb', ih0 + CUE_LEAD + 0.05, { caption: TEXT.climb, at: nearSteps, range: 40, id: 'into-heichal' });
  // the brothers up to the higher rovadim, the north half kept for them; M by the top landing ⚙
  const uSpots = [];
  for (let j = 0; j < 9; j++) { uSpots.push([r2.X, 325.3 + 1.82 * j, r2.Z]); uSpots.push([r1.X, 325.3 + 1.82 * j, r1.Z]); }
  BR.forEach((S, k) => {
    S.until(ih0 + 0.55 + 0.012 * k, { pose: 'stand', heading: 270, sway: 8, seed: SEED + 40 + k });
    S.walk([uSpots[k]], { speed: STAIR });
    S.act(0.05, { pose: 'stand', heading: 270 });
  });
  M1.until(ih0 + 0.5, { pose: 'stand', heading: 270, sway: 8, seed: SEED + 7 });
  const uM = [topX + 0.9, 334.6, HE];
  M1.walk([uM], { speed: STAIR });

  // A: "took the Teni, prostrated and went out" (Tamid 6:1) — he sets it beside him while he lies full length ⚙
  const kA = [137.8, 331.6, HE], kB = [137.8, 328.4, HE], kP = [138.0, 330.6, HE];
  const beside = (k) => [k[0] - 0.4, k[1] + (k[1] > ax ? 1.2 : -1.2), HE];
  A2.until(ih0 + 0.5, { pose: 'stand', heading: 270, sway: 6, seed: SEED + 8 });
  A2.walk([...upSteps(P, 322.6, 327.6), ...intoKodesh(P, 331.0), [H.teniAt[0] + 0.85, H.teniAt[1] + 0.3, HE]], { speed: WALK });
  A2.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: 240 });
  const tTeniUp = A2.now();
  A2.act(0.06, { pose: 'bow', phase: [0.7, 1], props: ['teni', null] });
  A2.walk([kA], { speed: 0.8, pose: 'carry_walk' });
  A2.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 20 });
  const tTeniBeside = A2.now();
  A2.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  A2.act(0.04, { pose: 'stand', heading: 270 });
  A2.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  A2.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 20 });
  const tTeniBeside1 = A2.now();
  A2.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['teni', null] });
  const aTop = [topX, 322.0, HE];
  A2.walk([[150, 329.0, HE], ...outOfKodesh(P, 324.6), aTop], { speed: WALK, pose: 'carry_walk' });
  win(D, 'teni', tTeniDown, tTeniUp, H.teniAt, 80);
  win(D, 'teni', tTeniBeside, tTeniBeside1, beside(kA), 80);

  // B: the eastern lamp cleaned, the western left; the Kuz from the second step (Tamid 6:1)
  B2.until(ih0 + 1.2, { pose: 'stand', heading: 270, sway: 6, seed: SEED + 9 });
  B2.walk([...upSteps(P, 324.6, 328.6), ...intoKodesh(P, 330.0), [143, 328.6, HE], H.stoneFoot], { speed: WALK });
  B2.shift(H.stoneTop, 0.07, { heading: 180 });
  B2.act(0.06, { pose: 'stand', face: lampAt(0) });
  B2.act(0.32, { pose: 'tend_lamp', phase: { cycle: 1 / 0.3 }, face: lampAt(0) });
  D.lampOut[0] = B2.now() - 0.12;
  const tLamp0 = D.lampOut[0];
  B2.act(0.06, { pose: 'stand', heading: 0 });
  B2.act(0.08, { pose: 'bow', phase: [0, 0.42] });
  const tKuzUp = B2.now();
  B2.act(0.07, { pose: 'bow', phase: [0.7, 1], props: ['kuz', null] });
  B2.shift(H.stoneFoot, 0.07, { heading: 0 });
  B2.walk([kB], { speed: 0.9 });
  B2.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 160 });
  const tKuzBeside = B2.now();
  B2.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  B2.act(0.04, { pose: 'stand', heading: 270 });
  B2.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  B2.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 160 });
  const tKuzBeside1 = B2.now();
  B2.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['kuz', null] });
  const bTop = [topX, 323.9, HE];
  B2.walk([[150, 329.0, HE], ...outOfKodesh(P, 324.6), bTop], { speed: WALK });
  win(D, 'kuz', tKuzDown, tKuzUp, H.kuzAt, 90);
  win(D, 'kuz', tKuzBeside, tKuzBeside1, beside(kB), 90);
  cue(D, 'lamp0', tLamp0, { caption: TEXT.lamp, at: [H.stoneTop[0], H.stoneTop[1] + 3, HE], range: 26, id: 'into-heichal-lamp' });

  // P: the coals heaped on the golden altar and spread with the rim of the pan (Tamid 6:2) ⚙ the pan set by him to prostrate
  P1.until(ih0 + 2.2, { pose: 'carry', heading: 270, sway: 6, seed: SEED + 10 });
  P1.walk([...upSteps(P, 322.2, 328.2), ...intoKodesh(P, 330.5), H.goldEast], { speed: CARRY, pose: 'carry_walk' });
  P1.act(0.05, { pose: 'carry', heading: 270 });
  P1.act(0.14, { pose: 'pour', phase: [0, 1], heading: 270 });
  const tHeap = P1.now() - 0.06;
  P1.act(0.26, { pose: 'sweep', phase: { cycle: 1.7 }, heading: 270 });
  P1.walk([kP], { speed: 0.7, pose: 'walk' });
  P1.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 200 });
  const tPanDown = P1.now();
  P1.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
  P1.act(0.04, { pose: 'stand', heading: 270 });
  P1.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  P1.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 200 });
  const tPanUp = P1.now();
  P1.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['machtah_gold', null] });
  const pTop = [topX + 1.2, 323.0, HE];
  P1.walk([[150, 329.0, HE], ...outOfKodesh(P, 324.6), pTop], { speed: WALK, pose: 'carry_walk' });
  P1.act(0.05, { pose: 'carry', heading: 90 });
  win(D, 'machtah_gold', tPanDown, tPanUp, [kP[0] - 0.4, kP[1] - 1.2, HE], 120);
  D.glow.push({ t0: tGoldTaken, t1: tHeap, slot: ['gazit', 4], hand: false });
  D.coals.push({ on: tHeap, burn: NaN });
  cue(D, 'heap', tHeap + 0.02, { caption: TEXT.heap, at: H.goldEast, range: 26, id: 'into-heichal-heap' });

  // I and F wait on the third rovad (the north part is the brothers')
  const uI = [r2.X, 321.6, r2.Z], uF = [r2.X, 323.5, r2.Z];
  I1.until(ih0 + 0.62, { pose: 'stand', heading: 270, sway: 6, seed: SEED + 11 });
  I1.walk([uI], { speed: STAIR, pose: 'walk' });
  F1.until(ih0 + 0.66, { pose: 'stand', heading: 270, sway: 6, seed: SEED + 12 });
  F1.walk([uF], { speed: STAIR });

  // ------------------------------------------------------------------------------------------------ 5. the incense
  const kt = { enter: k0 + 0.1, give: k0 + 0.6, pour: k0 + 0.84, warn: k0 + 1.0, out: k0 + 1.14, hakter: k0 + 1.45, withdraw: k0 + 1.62, burn: k0 + 2.3 };
  const iAt = H.goldEast, fAt = [H.goldEast[0] + 0.5, H.goldEast[1] + 1.9, HE];
  I1.until(kt.enter, { pose: 'stand', heading: 270 });
  I1.walk([[topX - 0.6, 322.6, HE], ...intoKodesh(P, 330.2), iAt], { speed: WALK, pose: 'walk' });
  I1.until(kt.give, { pose: 'stand', heading: 270 });
  I1.act(0.1, { pose: 'stand', face: fAt });
  const tKafDown = layIncense(I1, kt, iAt, fAt, H);
  const tBurn = kt.burn + 0.08;
  const kI = [137.9, 330.2, HE];
  I1.shift(kI, 0.07, { pose: 'stand', heading: 270 });
  I1.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  I1.shift([iAt[0] + 1.0, iAt[1] - 0.5, HE], 0.07, { heading: 220 });
  I1.act(0.06, { pose: 'bow', phase: [0, 0.42] });
  const tKafUp2 = I1.now();
  I1.act(0.05, { pose: 'bow', phase: [0.7, 1], props: ['kaf_covered', null] });    // the cover put back on ⚙ (Tamid 7:2)
  const tIOut = I1.now();
  win(D, 'kaf', tKafDown, tKafUp2, [iAt[0] - 0.2, iAt[1] - 1.1, HE], 90);
  F1.until(kt.enter + 0.05, { pose: 'stand', heading: 270 });
  F1.walk([[topX - 0.6, 324.2, HE], ...intoKodesh(P, 331.4), fAt], { speed: WALK });
  F1.until(kt.give + 0.08, { pose: 'stand', face: iAt });
  F1.act(0.06, { pose: 'carry', face: iAt, props: ['bazach', null] });
  F1.until(kt.pour, { pose: 'carry', face: iAt });
  F1.act(0.14, { pose: 'pour', phase: [0, 1], face: iAt });
  F1.until(kt.warn, { pose: 'carry', face: iAt });
  F1.act(0.12, { pose: 'point', face: H.goldC });
  F1.until(kt.out, { pose: 'carry', face: iAt });
  F1.walk([[150, 331.8, HE], ...outOfKodesh(P, 325.6), [topX, 325.6, HE]], { speed: WALK, pose: 'carry_walk' });
  F1.act(0.05, { pose: 'carry', heading: 90 });
  cue(D, 'bazach', kt.give + 0.05, { caption: TEXT.bazach, at: iAt, range: 22, id: 'ketoret-bazach' });
  cue(D, 'warn', kt.warn + 0.02, { caption: TEXT.warn, at: iAt, range: 22, id: 'ketoret-warn' });
  // "Hakter!" from the head of the steps; then everyone withdraws (Tamid 6:3; Yoma 44a)
  M1.until(kt.hakter, { pose: 'stand', heading: 270, sway: 4, seed: SEED + 13 });
  M1.act(0.12, { pose: 'point', heading: 268 });
  cue(D, 'hakter', kt.hakter + 0.02, { caption: TEXT.hakter, at: uM, range: 60, id: 'ketoret-hakter' });
  cue(D, 'burn', tBurn + 0.05, { caption: TEXT.burn, at: iAt, range: 30, id: 'ketoret-burn' });
  D.incense.push({ t0: tBurn, t1: tBurn + 9 });
  D.coals[D.coals.length - 1].burn = tBurn;

  // the withdrawal: the brothers and the memuneh to the north of the altar; the servers south-west of it ⚙
  const north = P.north;
  BR.forEach((S, k) => {
    S.until(kt.withdraw + 0.012 * k, { pose: 'stand', heading: 270, sway: 6, seed: SEED + 60 + k });
    const y = uSpots[k][1];
    S.walk([[S.cur[0] + 0.5, Math.min(339.9, y + 0.6), S.cur[2]], [steps.foot, Math.min(339.9, y + 1.2), AZ], [P.apronX + 0.6, 340.1, AZ], north[k]], { speed: 1.0 });
    S.act(0.05, { pose: 'stand', heading: 270 });
  });
  M1.walk([[topX + 1.2, 337.0, HE], [steps.foot, 339.6, AZ], north[18]], { speed: 1.0 });
  M1.act(0.05, { pose: 'stand', heading: 250 });
  const south = P.south;
  const toSouth = (S, k, tGo, h = 20) => {
    S.until(tGo, { pose: S.props[0] ? 'carry' : 'stand', heading: 90, sway: 4, seed: SEED + 80 + k });
    S.walk([[steps.foot, 321.2, AZ], [P.apronX, 320.9, AZ], way.sw, [200.6, 302.4, AZ], south[k]], { speed: 1.0, pose: S.props[0] ? 'carry_walk' : 'walk' });
    S.act(0.05, { pose: S.props[0] ? 'carry' : 'stand', heading: h });
  };
  A2.act(0.05, { pose: 'carry', heading: 90 });
  B2.act(0.05, { pose: 'carry', heading: 90 });
  toSouth(A2, 0, kt.withdraw + 0.02);
  toSouth(B2, 1, kt.withdraw + 0.05);
  toSouth(P1, 2, kt.withdraw + 0.08);
  toSouth(F1, 3, kt.withdraw + 0.11);
  I1.walk([[150, 329.4, HE], ...outOfKodesh(P, 322.4), [topX - 0.6, 321.6, HE]], { speed: WALK, pose: 'walk' });
  I1.walk([[steps.foot, 321.2, AZ], [P.apronX, 320.9, AZ], way.sw, [200.6, 302.4, AZ], south[4]], { speed: 1.0, pose: 'walk' });
  I1.act(0.05, { pose: 'stand', heading: 20 });

  // the gate curtain hangs closed while he is alone inside; it is lifted for each who passes (Tamid 7:1) ⚙
  const cur = D.curtain;
  const fOut = kt.out + 0.18, iOut = tIOut + 0.22;
  cur.push({ t: fOut - 0.06, f: 1 }, { t: fOut, f: 0.32 }, { t: fOut + 0.08, f: 0.32 }, { t: fOut + 0.14, f: 0 }, { t: iOut - 0.06, f: 0 }, { t: iOut, f: 0.34 }, { t: iOut + 0.1, f: 0.34 });

  // ------------------------------------------------------------------------------------------------ 6. the prostrations
  let kIn = k0 + 4.2;
  let KG = null, SG = null, lifted = NaN;
  if (sab) {
    // the Kohen Gadol (he serves on Shabbat — tamid-morning.js; Rambam KhM 5:12) with the segan, from the Gazit before
    // the withdrawal, waits north of the altar; then three hold him as he goes in to prostrate (Tamid 7:1) ⚙
    kIn = k0 + 5.0;
    const kgWait = [223.4, 340.6, AZ], sgWait = [223.4, 343.2, AZ];
    KG = Script.from(k0 - 0.6, P.doors.gazit, 90, 'KG');
    SG = Script.from(k0 - 0.58, P.doors.gazit, 90, 'segan');
    KG.walk([...fromGazit.slice(0, -1), [199.8, 345.2, AZ], [206, 343.6, AZ], kgWait], { speed: 0.9 });
    SG.walk([...fromGazit.slice(0, -1).map((p) => [p[0] + 0.6, p[1] - 0.9, p[2]]), [200.4, 346.0, AZ], [206.4, 344.6, AZ], sgWait], { speed: 0.9 });
    const kgGo = k0 + 3.75;
    KG.until(kgGo, { pose: 'stand', heading: 260, sway: 5, seed: SEED + 14 });
    SG.until(kgGo, { pose: 'stand', face: kgWait, sway: 5, seed: SEED + 15 });
    const kK = [139.2, ax, HE];
    const kgPath = [[P.apronX + 0.4, 339.4, AZ], [steps.foot, 334.0, AZ], ...upSteps(P, 331.2, ax).slice(1), ...intoKodesh(P, ax), kK];
    KG.walk(kgPath, { speed: 0.75 });
    SG.walk(kgPath.map((p) => [p[0] + 0.3, p[1] + 1.25, p[2]]), { speed: 0.78 });
    const tKgIn = KG.now();
    KG.act(0.05, { pose: 'stand', heading: 270 });
    KG.act(PR + 0.02, { pose: 'prostrate', phase: [0, 1], heading: 270 });
    const tKgUp = KG.now();
    SG.until(tKgIn + 0.05, { pose: 'stand', heading: 270 });
    SG.act(PR + 0.02, { pose: 'bow', phase: [0.05, 0.95], heading: 250 });
    lifted = tKgUp + 0.22;
    const kgTop = [topX, 325.4, HE], sgTop = [topX + 0.4, 323.8, HE];
    KG.walk([[150, ax, HE], ...outOfKodesh(P, 325.4).slice(0, -1), kgTop], { speed: 0.75 });
    SG.walk([[150, ax + 1.2, HE], ...outOfKodesh(P, 323.8).slice(0, -1), sgTop], { speed: 0.78 });
    // two of the brothers hold him at his left and by the stones, then go back to the others
    for (const [k, dy, dx] of [[0, -1.25, 0], [1, 0, 1.4]]) {
      const S = BR[k];
      S.until(kgGo + 0.02, { pose: 'stand', heading: 270, sway: 6, seed: SEED + 100 + k });
      S.walk(kgPath.map((p) => [p[0] + dx, p[1] + dy, p[2]]), { speed: 0.76 });
      S.until(tKgIn + 0.05, { pose: 'stand', heading: 270 });
      S.act(PR + 0.02, { pose: 'bow', phase: [0.05, 0.95], heading: 270 + (dy ? 20 : 0) });
      S.walk([[150, ax + dy, HE], ...outOfKodesh(P, 336.0 + k).slice(0, -1), [topX + 0.6, 336.0 + k, HE], [steps.foot, 339.4, AZ], north[k]], { speed: 0.9 });
    }
    // the memuneh goes up to the curtain ahead of him and lifts it as he comes out
    M1.until(kgGo + 0.2, { pose: 'stand', heading: 250, sway: 6, seed: SEED + 16 });
    M1.walk([[P.apronX + 0.4, 339.0, AZ], [steps.foot, 337.4, AZ], [topX - 0.6, 337.4, HE], H.curtainMan], { speed: 1.0 });
    M1.until(lifted - 0.12, { pose: 'stand', heading: 200 });
    M1.act(0.28, { pose: 'point', heading: 192 });
    cur.push({ t: tKgIn - 0.42, f: 0 }, { t: tKgIn - 0.3, f: 0.5 }, { t: tKgIn - 0.12, f: 0.5 }, { t: tKgIn, f: 0 }, { t: lifted - 0.12, f: 0 }, { t: lifted, f: 0.55 }, { t: lifted + 0.2, f: 0.55 }, { t: lifted + 0.32, f: 1 });
    // only when he has come out do his brothers go in (Tamid 7:1)
    kIn = lifted + 0.12;
    cue(D, 'kg', tKgIn - 0.25, { caption: TEXT.kg, at: H.goldEast, range: 40, id: 'ketoret-kg' });
    cue(D, 'lift', lifted, { caption: TEXT.lift, at: H.curtainMan, range: 30, id: 'ketoret-lift' });
  } else cur.push({ t: iOut + 0.2, f: 1 });

  // the brothers go in, prostrate together, come out (Tamid 7:1) ⚙
  const PB = kIn + 0.92;
  const kneel = P.kneel;
  BR.forEach((S, k) => {
    S.until(kIn + 0.018 * k + (sab && k < 2 ? 0.3 : 0), { pose: 'stand', heading: 270, sway: 6, seed: SEED + 120 + k });
    const kn = kneel[k];
    const yS = 333.6 + (k % 4) * 1.2;
    S.walk([[P.apronX + 0.4, 339.6, AZ], [steps.foot, yS, AZ], ...upSteps(P, yS, ax + (k % 2 ? 1.0 : -1.0)).slice(1), ...intoKodesh(P, kn[1] > ax ? ax + 1.2 : ax - 1.2), kn], { speed: 1.05 + 0.1 * rand(SEED, 'ks', k) });
    // together, but each a breath apart (not in lockstep) ⚙
    S.until(PB - 0.04 + 0.012 * rand(SEED, 'pb', k), { pose: 'stand', heading: 270 });
    S.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  });
  if (!sab) {
    M1.until(kIn + 0.3, { pose: 'stand', heading: 250, sway: 6, seed: SEED + 17 });
    M1.walk([[P.apronX + 0.4, 339.6, AZ], [steps.foot, 336.0, AZ], ...upSteps(P, 336.0, ax + 1).slice(1), ...intoKodesh(P, ax + 1.2), kneel[18]], { speed: 1.1 });
  } else {
    M1.walk([[H.curtainMan[0] - 2, ax + 1.0, HE], ...intoKodesh(P, ax + 1.2).slice(1), kneel[18]], { speed: 0.9 });
  }
  M1.until(PB - 0.04, { pose: 'stand', heading: 270 });
  M1.act(PR, { pose: 'prostrate', phase: [0, 1], heading: 270 });
  D.prost.push(PB + 0.02);
  D.hush.push([mg + 0.05, PB + 0.1]);
  cue(D, 'brothers', PB, { caption: TEXT.brothers, sound: ['crowd-prostrate', null], at: H.goldEast, range: 300, id: 'ketoret-prostrate', crowd: true });

  // ------------------------------------------------------------------------------------------------ 7. the blessing
  // three rows on the rovadim facing the courts; the five with their vessels to the south (Tamid 7:2) ⚙
  const rowsY = [326.2, 328.8, 331.4, 334.0, 336.6, 339.2];
  const rowX = [r0, r1, r2];
  const bSpot = (k) => { const row = Math.floor(k / 6), j = k % 6; return [rowX[row].X, rowsY[j], rowX[row].Z]; };
  const bRaise = bk0 + CUE_LEAD, bDown = bk0 + 2.0;
  BR.forEach((S, k) => {
    const sp = bSpot(k);
    S.walk([[150, S.cur[1] > ax ? ax + 1.0 : ax - 1.0, HE], ...outOfKodesh(P, sp[1]), sp], { speed: 0.95 + 0.1 * rand(SEED, 'bs', k) });
    S.act(0.06, { pose: 'stand', heading: 90 });
    S.until(bRaise + 0.01 * (k % 5), { pose: 'stand', heading: 90, sway: 3, seed: SEED + 140 + k });
    S.until(bDown, { pose: 'raise_hands', heading: 90 });
    S.act(0.05, { pose: 'stand', heading: 90 });
  });
  const mB = [r2.X, 323.9, r2.Z];
  M1.walk([[150, ax + 1.0, HE], ...outOfKodesh(P, mB[1]), mB], { speed: 1.0 });
  M1.until(bRaise, { pose: 'stand', heading: 90, sway: 3, seed: SEED + 18 });
  M1.until(bDown, { pose: 'raise_hands', heading: 90 });
  // the five: Teni, Kuz, the fire-pan, the bazach, the kaf with its cover (Tamid 7:2)
  const five = [[A2, [r0.X, 321.4, r0.Z]], [B2, [r0.X, 323.5, r0.Z]], [P1, [r1.X, 321.4, r1.Z]], [I1, [r1.X, 323.5, r1.Z]], [F1, [r2.X, 321.8, r2.Z]]];
  five.forEach(([S, sp], j) => {
    // (the kaf "and its cover in one hand", Tamid 7:2: by the handle — stand / walk)
    const [hp, wp] = S === I1 ? ['stand', 'walk'] : ['carry', 'carry_walk'];
    S.until(bk0 - 1.6 + 0.08 * j, { pose: hp, heading: 20, sway: 5, seed: SEED + 160 + j });
    S.walk([way.sw, [P.apronX, 320.9, AZ], [steps.foot, sp[1], AZ], sp], { speed: 0.9, pose: wp });
    S.act(0.06, { pose: hp, heading: 90 });
    S.until(bk1 - 0.7 + 0.05 * j, { pose: hp, heading: 90, sway: 2, seed: SEED + 170 + j });
  });
  if (sab) {
    const kgB = [topX, ax + 0.5, HE], sgB = [topX, ax - 2.1, HE];
    KG.until(bk0 - 0.45, { pose: 'stand', heading: 90, sway: 4, seed: SEED + 19 });
    KG.walk([kgB], { speed: 0.6 });
    SG.until(bk0 - 0.42, { pose: 'stand', heading: 90, sway: 4, seed: SEED + 20 });
    SG.walk([sgB], { speed: 0.6 });
    KG.until(bRaise, { pose: 'stand', heading: 90 });
    SG.until(bRaise, { pose: 'stand', heading: 90 });
    KG.until(bDown, { pose: 'raise_hands', heading: 90 });   // people draws raise_hands_low for the Kohen Gadol (Sotah 7:6)
    SG.until(bDown, { pose: 'raise_hands', heading: 90 });
    // down to tamid-morning's hand-over at the north end of the apron: it takes them up the ramp to the limbs
    KG.until(bk1 - 0.55, { pose: 'stand', heading: 90, sway: 3, seed: SEED + 21 });
    KG.walkBy(lu0 - 0.15, [[topX + 1, ax + 4.2, HE], [steps.foot, 338.2, AZ], [P.apronX, 339.0, AZ]], { speed: 0.8 });
    KG.act(0.15, { pose: 'stand', heading: 180 });
    SG.until(bk1 - 0.55, { pose: 'stand', heading: 90, sway: 3, seed: SEED + 22 });
    SG.walkBy(lu0 - 0.05, [[topX + 1, ax + 5.4, HE], [steps.foot, 339.4, AZ], [P.apronX, 340.2, AZ]], { speed: 0.8 });
    SG.act(0.05, { pose: 'stand', heading: 180 });
    add(D, 'kg', 0, KG);
    add(D, 'segan', 0, SG);
  }
  cue(D, 'bless', bRaise + 0.02, { caption: TEXT.bless, at: [steps.top.X + 8, ax, 19], range: 120, id: 'birkat-kohanim' });
  D.prost.push(bDown + 0.05);
  cue(D, 'respond', bDown + 0.05, { caption: TEXT.respond, sound: ['crowd-prostrate', null], at: [steps.top.X + 8, ax, 19], range: 160, id: 'birkat-response', crowd: true });

  // ------------------------------------------------------------------------------------------------ 8. afterwards
  // the brothers go: most north to the Gazit; two to the tables to blow at the libation, one to the wine on the ramp
  // (song.js continues g10, g11, g12), one puts the magrefah back, the Medichin four go back there ⚙
  const out = { trumpeters: [10, 11], wine: 12, BR, after: {} };
  BR.forEach((S, k) => {
    S.until(bk1 - 0.62 + 0.02 * k, { pose: 'stand', heading: 90, sway: 4, seed: SEED + 180 + k });
    const sp = bSpot(k);
    if (k === 10 || k === 11 || k === 12) {
      S.walk([[steps.foot, sp[1] < 330 ? 321.4 : 321.4 + (k - 10) * 0.6, AZ], [P.apronX, 320.9, AZ], way.sw, [200.4, 302.0, AZ], [203.2 - (k - 10) * 0.5, 296.0, AZ]], { speed: 1.0 });
      out.after[k] = S;
    } else if (k === 16) {
      S.walk([[steps.foot, 321.6, AZ], [A.magrefahLand[0] + 0.9, A.magrefahLand[1] + 0.5, AZ]], { speed: 1.0 });
      S.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: 250 });
      const tPick = S.now();
      S.act(0.06, { pose: 'bow', phase: [0.7, 1], props: ['magrefah', null] });
      S.walk([[A.magrefahRest[0] + 0.4, A.magrefahRest[1] + 1.0, AZ]], { speed: 1.0 });
      S.act(0.07, { pose: 'bow', phase: [0, 0.42], heading: 190 });
      const tRest = S.now();
      S.act(0.06, { pose: 'bow', phase: [0.7, 1], props: null });
      S.walk([[200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 279.5, AZ], [196.0, 279.0, AZ], ...[...way.medichinOut].reverse(), P.doors.medichin], { speed: WALK });
      S.hide(S.now() + 0.01);
      win(D, 'magrefah', mg + 0.006, tPick, A.magrefahLand, 262);
      win(D, 'magrefah', tRest, cp0 - 0.3 + 1440, A.magrefahRest, 180);
    } else if (k >= 13) {
      S.walk([[steps.foot, 321.2 + (k - 13) * 0.4, AZ], [197.8, 318.8, AZ], [195.8, 301.0, AZ], [184.5, 277.5, AZ], P.doors.medichinOut, P.doors.medichin], { speed: WALK });
      S.hide(S.now() + 0.01);
    } else {
      S.walk([[steps.foot, Math.max(sp[1], 333) + 0.4, AZ], [P.apronX, 340.0, AZ], ...toGazit.slice(1)], { speed: WALK });
      S.hide(S.now() + 0.01);
    }
  });
  M1.until(bk1 - 0.5, { pose: 'stand', heading: 90, sway: 3, seed: SEED + 23 });
  M1.walk([[steps.foot, 336.6, AZ], [P.apronX, 340.0, AZ], ...toGazit.slice(1)], { speed: WALK });
  M1.hide(M1.now() + 0.01);
  add(D, 'servers', SRV.M, M1);
  // the five: the inner altar's and the Menorah's ashes to Beit HaDeshen (site altar.beit-hadeshen), then the vessels
  // back on the silver table ⚙; out by the south chambers
  const dsh = A.deshenStand;
  const vesselsBack = (S, k, name, ash) => {
    const path = [[steps.foot, 321.0, AZ], [P.apronX, 320.9, AZ], way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 279.5, AZ]];
    const cw = S === I1 ? 'walk' : 'carry_walk';
    if (ash) {
      S.walk([...path, [207.5, 275.4, AZ], [224.6, 273.6, AZ], [dsh[0] + 0.4 * k, dsh[1] - 0.6 + 0.9 * k, AZ]], { speed: 1.0, pose: 'carry_walk' });
      S.act(0.04, { pose: 'carry', heading: 270 });
      S.act(0.14, { pose: 'pour', phase: [0, 1], heading: 270 });
      S.walk([[224.6, 273.6, AZ], [207.5, 275.4, AZ], [tableE[0], A.onSilver(k)[1], AZ]], { speed: 1.0, pose: 'carry_walk' });
    } else S.walk([...path, [207.0, 283.6, AZ], [tableE[0], A.onSilver(k)[1], AZ]], { speed: 1.0, pose: cw });
    S.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 270 });
    const tDown = S.now();
    S.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });
    S.walk([[203.4, 279.5, AZ], [196.0, 279.0, AZ], ...[...way.medichinOut].reverse(), P.doors.medichin], { speed: WALK });
    S.hide(S.now() + 0.01);
    if (name) out.after[name] = tDown;
    return tDown;
  };
  const tTeniBack = vesselsBack(A2, 0, 'teni', true);
  const tKuzBack = vesselsBack(B2, 1, 'kuz', true);
  const tGoldBack = vesselsBack(P1, 2, 'machtah_gold', false);
  const tKafBack = vesselsBack(I1, 3, 'kaf', false);
  F1.walk([[steps.foot, 321.6, AZ], [P.apronX, 320.9, AZ], way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 283.0, AZ], [207.0, 283.6, AZ], [tableE[0] + 0.6, A.onSilver(3)[1] + 0.6, AZ]], { speed: 1.0, pose: 'carry_walk' });
  F1.act(0.06, { pose: 'bow', phase: [0, 0.4], heading: 260 });
  F1.act(0.05, { pose: 'bow', phase: [0.7, 1], props: null });     // the bazach back into the kaf ⚙
  F1.walk([[203.4, 279.5, AZ], [196.0, 279.0, AZ], ...[...way.medichinOut].reverse(), P.doors.medichin], { speed: WALK });
  F1.hide(F1.now() + 0.01);
  out.vessels = { teni: tTeniBack, kuz: tKuzBack, machtah_gold: tGoldBack, kaf: tKafBack, lockup: LK0 };
  // the Teni and the Kuz stay on the silver table until the vessels go back in at the locking ⚙
  win(D, 'teni', tTeniBack, LK0, A.onSilver(0), 90);
  win(D, 'kuz', tKuzBack, LK0, A.onSilver(1), 90);
  out.mg = mg; out.PB = PB; out.blessDown = bDown;
  return out;
}

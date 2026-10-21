// Sha'ar Nikanor, the eastern gate of the Azarah, whose gateway was left without the court's sanctity so that those
// awaiting atonement could stand in it (Yoma 30b–31a; Sotah 1:5; report §59 #5). Events served (choreo
// 'nikanor-stations'):
//   impure-east-gate       at the crash of the magrefah the head of the ma'amad stations the impure at the eastern
//                          gate (Tamid 5:6): they come up the fifteen steps and stand in the gateway and on the landing
//                          until the morning service is done.
//   metzora                a healed metzora's eighth day, on the days private-offerings counts one (Negaim 14:7–10;
//                          Vayikra 14:10–20): he waits in the lepers' chamber (the immersion itself is not shown — see
//                          the decisions log), comes up to the gate; his live asham and the log of oil are waved; he
//                          leans on the asham from the gateway; it is slaughtered in the north, one kohen taking its
//                          blood in a vessel for the altar and one in his palm for the man, who puts his head, hand and
//                          foot into the gate for the blood on ear, thumb and toe; oil poured into a colleague's palm,
//                          sprinkled seven times toward the west, put on the same places and the rest on his head. Then
//                          his chatat and his olah (Rambam Mechusrei Kapparah 4:2), brought to the gate for him to lean
//                          on and offered at the rings and the altar (g4/sets.js), with the libations of all three; once
//                          their blood is applied he goes in.
//   nikanor-purifications  mothers after childbirth and the healed zav / zavah stand in the gateway while their pair
//                          of birds is offered (Sotah 1:5; Vayikra 12:6–8, 15:14, 29); a kohen takes the birds in at
//                          the gate and carries them to the altar's south-west corner, where the bird offerings are
//                          made (that act is the private-offerings lane's). A woman does not lean (Menachot 9:8).
// Everyone comes up from the Mount by the circuit (g4/mount.js) and leaves by it; kohanim come and go through the door
// of Pinchas' chamber into Ezrat Yisrael, or (the asham's) into Lishkat HaMedichin. Pure function of (t, date, seed).
import { clamp, smooth, rand, within } from '../lib/core.js';
import { crossed } from '../lib/cue.js';
import { Itin, Troupe, Route, daySeed, dayQuantile, randInt, tierCount, win, hm, observerNear, norm, applySample, stride } from './g4/lib.js';
import { visit, fitAt, release } from './g4/mount.js';
import { g4Book, planBefore } from './g4/book.js';
import { geoOf, scriptMetzora, placeSet, bookSet, SetCast, g5PlanOf, setsSource } from './g4/sets.js';
import { METZORA_T, VESSEL_START, PINCHAS, TO_RING, vesselKohen, vesselAt } from './g4/metzora.js';
import { OFFERING_TYPES } from '../../data/offerings.js';

const SEED = 0x6e6b;
const WHO = 'nikanor-stations';
// the head of the ma'amad's place: the front (south) edge of the ma'amad's place in Ezrat Yisrael, north of Pinchas'
// chamber (g3/places.js maamad: Y from 349) ⚙
const MAAMAD_HEAD = [252.6, 347.9, 13.5];
// the metzora's chatat and olah: ways to lay them out at the metzora's ring and G4's rings and hooks (g4/sets.js)
const METZORA_COMBOS = [{ rC: 'm', rO: 0, hC: 1, hO: 0 }, { rC: 'm', rO: 1, hC: 0, hO: 1 }, { rC: 'm', rO: 0, hC: 3, hO: 2 }, { rC: 'm', rO: 1, hC: 2, hO: 3 }];
const CAPTION_RANGE = 32;
const EN_IN = [393, 332, 6], EN_OUT = [393, 329, 6];
// up the fifteen steps on the south lane, down on the north (radial at the axis — tread-midpoint line r 17.75 → 10.25)
const UP = (y) => [EN_IN, [277.75, y, 6], [270.25, y, 13.5]];
const DOWN = (y) => [[270.25, y, 13.5], [277.75, y, 6], EN_OUT];
// places in and before the gateway (clear of the open leaves, which stand at 72° in the passage — courts/nikanor.js)
const GATE_SPOTS = [[257.7, 327.7, 13.5], [257.7, 333.3, 13.5], [261.6, 326.6, 13.5], [261.6, 334.4, 13.5]];
const IMPURE_SPOTS = [[257.7, 327.7], [257.7, 333.3], [261.4, 326.4], [261.4, 329.2], [261.4, 331.8], [261.4, 334.6]];
const IMPURE_WAIT = [[282.5, 323.5], [283.6, 326.6], [282.2, 329.4], [283.4, 333.6], [282.4, 336.4], [283.8, 339.2]];
const KOHEN_POSTS = [[253.0, 328.2, 13.5], [253.0, 332.8, 13.5]];
const RECEIVE_AT = [255.7, 330.5, 13.5];
// from Ezrat Yisrael up over the duchan into Ezrat Kohanim and round the ramp's foot to the altar's SW corner ⚙
const TO_SW = [[252.4, 329.0, 13.5], [246.0, 325.6, 13.5], [244.4, 325.2, 13.5], [241.6, 324.8, 16], [236.2, 318, 16], [236.2, 273.0, 16], [206.5, 273.0, 16], [203.6, 279, 16], [199.4, 300.6, 16], [200.2, 303.6, 16]];
// the asham: from Nikanor over the duchan to its ring in the north, then to a flaying station at the nanasin ⚙
const RING = [229, 355.5, 16];
const HOOK = [229, 383.75, 16];
const TO_HOOK = [[230.2, 356.6, 16], [234.0, 362, 16], [234.0, 379.5, 16], [230.6, 382.0, 16]];
// …and the dressed carcass to Lishkat HaMedichin, where the innards are rinsed (Middot 5:3) ⚙
const TO_MEDICHIN = [[230.6, 382.0, 16], [235.0, 378, 16], [237.8, 345, 16], [237.8, 280, 16], [148.0, 280, 16], [147.25, 276.5, 16], [147.25, 272.5, 16]];
// the ways of the asham's blood to the altar's corners and the kohanim's door: g4/metzora.js (shared with G5's booking)

export default {
  id: 'nikanor-stations',
  lead: 70,           // the head of the ma'amad is at his place from the ma'amad's start (sunrise − 8)
  lag: 30,
  importance: 1,

  init(ctx, events, sim) {
    sim.setBounds([150, 230, -30], [430, 400, 30]);
    const P = (name, role, count, seed, imp = 1, prop = null) => sim.pool({ name, role, count, seed: SEED + seed, importance: imp, prop });
    const state = {
      impure: P('impure', 'israelite', 6, 1),
      head: P('head-of-maamad', 'elder', 1, 2, 2),
      // the healed metzora on his eighth day: he shaved all his hair on the seventh — head, beard and brows (Vayikra 14:9)
      // — and is no longer bound by 13:45 (people-4: an Israelite with setShaven('all'), not the declared 'metzora' role)
      metzora: sim.pool({ name: 'metzora', role: 'israelite', count: 1, seed: SEED + 3, importance: 2, shaven: 'all' }),
      mk: P('metzora-kohanim', 'kohen', 3, 4, 2),
      lamb: sim.pool({ name: 'asham', animal: 'lamb', count: 1, seed: SEED + 5, importance: 2 }),
      women: P('mothers', 'woman', 6, 6),
      zavim: P('zavim', 'israelite', 2, 7),
      nk: P('gate-kohanim', 'kohen', 2, 8),
      // the metzora's chatat and olah: the kohanim, the lambs, his agent who brings them (g4/sets.js)
      setK: P('metzora-set-kohanim', 'kohen', 12, 9, 2),
      setLamb: sim.pool({ name: 'metzora-set-lambs', animal: 'lamb', count: 2, seed: SEED + 10, importance: 2 }),
      // his chatat is a ewe lamb (Vayikra 14:10)
      setEwe: sim.pool({ name: 'metzora-set-ewes', animal: 'ewe', count: 1, seed: SEED + 13, importance: 2 }),
      agent: P('metzora-agent', 'israelite', 2, 11),
      hung: null,
      plan: null, planGen: -1, troupes: [],
      fmt: (m) => ctx.time?.format?.(m) ?? hm(m),
      s: {}, s2: {},
    };
    try { state.hung = ctx.people?.spawnProp?.('lamb_hung', { seed: SEED }) || null; state.hung?.setVisible(false); } catch { state.hung = null; }
    state.cast = new SetCast(ctx, { kohen: state.setK, lamb: state.setLamb, ewe: state.setEwe, israelite: state.agent });
    try { state.offSource = ctx.schedule?.addSource?.(setsSource(ctx, 'g4-metzora', () => plan(ctx, state, sim).sets)); } catch (e) { console.warn('[sim:g4] source failed', e); }
    return state;
  },

  /** the day's plan (g4/book.js: planned last of the G4 modules) */
  plan(ctx, state, sim) { return plan(ctx, state, sim); },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, state, sim);
    for (const tr of state.troupes) tr.update(ctx, sim, t, tr.cb);
    state.cast.update(sim, t, dt);
    asham(ctx, state, sim, t, P);
    cues(ctx, state, sim, t, P);
  },

  release(ctx, state) { state.hung?.setVisible(false); state.cast?.hide(); },

  dispose(ctx, state) { state.hung?.dispose?.(); state.cast?.dispose(); },

  debug(s) {
    const P = s.plan;
    if (!P) return 'no plan';
    return `impure ${P.W.impure ? s.fmt(P.tStation) : '-'} · metzora ${P.M ? s.fmt(P.M.t0) : `none (count ${P.nMetzora ?? '-'})`} · birds: ${P.arrivals.length} (${P.arrivals.filter((a) => a.zav).length} zav/zavah)${P.g5 ? '' : ' · own plan'}`;
  },
};

// ================================================================================================ the plan
function plan(ctx, state, sim) {
  if (state.plan && state.planGen === sim.generation && state.planDate === ctx.time?.dateString) return state.plan;
  planBefore(ctx, sim, WHO);
  const book = g4Book(ctx, sim);
  book.dropOwner(WHO);
  state.book = book;
  const seed = daySeed(ctx, SEED);
  const W = { impure: win(sim, 'impure-east-gate'), metzora: win(sim, 'metzora'), purif: win(sim, 'nikanor-purifications') };
  const P = { W, seed, arrivals: [], handovers: [], M: null, tStation: NaN, cueKeys: [], sets: [] };
  state.troupes = [];
  state.cast.reset();
  // private-offerings' plan for the date (built now if it is not yet): the day's counts and its bird jobs
  const P5 = g5PlanOf(ctx, sim);
  P.P5 = P5;
  if (W.impure) impure(state, P, seed, sim);
  if (W.metzora) metzora(state, P, seed, sim, ctx);
  if (W.purif) purifications(state, P, seed, sim, ctx);
  for (const tr of state.troupes) tr.replan(sim.generation);
  state.plan = P;
  state.planGen = sim.generation;
  state.planDate = ctx.time?.dateString;
  return P;
}
/** a visit from the city, booked on the Mount, timed so that its it.mark falls on `target` */
const booked = (state, target, build) => { const r = fitAt(state.book, WHO, target, (mp) => { const it = new Itin(); it.mp = mp; build(it); it.done(); return it; }); return { t0: r.t0, T: r.it.T, it: r.it }; };

// ------------------------------------------------------------------------------------------------ the impure
function impure(state, P, seed, sim) {
  const [w0, w1] = P.W.impure;
  // the magrefah (ketoret-morning) falls CUE_LEAD into its event; the station follows it
  const mag = sim.event('magrefah');
  const tMag = mag && Number.isFinite(mag.t0) ? mag.t0 + 0.5 : w0 + 0.5;
  const tStation = Math.max(w0 + 0.55, tMag + 0.15);
  P.tStation = tStation;
  P.cueKeys.push({ key: `impure:${Math.round(tStation * 10)}`, at: tStation + 0.1, pos: [258, 330.5, 13.5], text: { en: "The magrefah has sounded: the head of the ma'amad stands the impure at the eastern gate (Tamid 5:6)", he: 'וְרֹאשׁ הַמַּעֲמָד הָיָה מַעֲמִיד אֶת הַטְּמֵאִים בְּשַׁעַר הַמִּזְרָח' } });
  const n = tierCount(sim, 6, 3, 0.5);
  const planFn = (k) => {
    if (k >= n) return [];
    const v = 1.15 + 0.1 * rand(seed, 'iv', k);
    const w = IMPURE_WAIT[k], sp = IMPURE_SPOTS[k], lane = sp[1] < 330.5 ? 329.6 : 331.4;
    const tArr = tStation - 5 - 0.7 * k - rand(seed, 'ia', k) * 3;   // they come in a few minutes before, and wait
    const tUp = tStation + 0.25 + 0.1 * k;                              // called up the steps
    return [booked(state, tArr, (it) => visit(it, {
      gate: 'ce', spur: 'en', v,
      build: (it) => {
        it.walkTo([EN_IN, [w[0], w[1], 6]], v);
        it.mark = it.T;
        const t0 = (it.mp?.t0 ?? 0) + it.T;                             // the clock as he reaches his place
        it.stand(Math.max(0.3, tUp - t0), 270);
        const a = it.T;
        it.walkTo([[w[0], w[1], 6], [277.75, lane, 6], [270.25, lane, 13.5], [sp[0], sp[1], 13.5]], 0.95);
        it.stand(Math.max(0.5, w1 - 0.4 + 0.2 * k - (tUp + it.T - a)), 270);
        it.walkTo([[sp[0], sp[1], 13.5], ...DOWN(sp[1] < 330.5 ? 329.2 : 331.8)], 1.0);
      },
    }))];
  };
  state.troupes.push(new Troupe(state.impure, { plan: planFn, legs: (e) => e.it }));
  // the head of the ma'amad: up from the city with the ma'amad to the front of its place in Ezrat Yisrael; as the
  // magrefah falls he goes to the gateway and stations the impure, then back to the ma'amad until it disperses, and
  // home the way he came ⚙
  const maam = sim.event('maamad-morning');
  const m0 = maam && Number.isFinite(maam.t0) ? maam.t0 : tStation - 50;
  const tBack = Math.min(w1 - 1, tStation + 2.5);
  const tEnd = maam && Number.isFinite(maam.t1) ? Math.max(tBack + 2, maam.t1) : w1;
  const toPlace = [EN_IN, [277.75, 331.4, 6], [270.25, 331.4, 13.5], [258.2, 331.6, 13.5], [253.8, 333.2, 13.5], MAAMAD_HEAD];
  const fromPlace = [MAAMAD_HEAD, [253.4, 333.6, 13.5], [258.4, 331.2, 13.5], [270.25, 331.0, 13.5], [277.75, 331.0, 6], EN_OUT];
  const head = booked(state, m0 + 1, (it) => visit(it, {
    gate: 'ce', spur: 'en', v: 1.1,
    build: (it) => {
      it.walkTo(toPlace, 1.0);
      it.mark = it.T;
      const c0 = (it.mp?.t0 ?? 0);
      // at the front of the ma'amad, facing the Sanctuary, until a little before the magrefah
      const walkIn = (Math.hypot(256.6 - MAAMAD_HEAD[0], 330.5 - MAAMAD_HEAD[1]) * 0.48) / 1.1 / 60 + 0.05;
      it.stand(Math.max(0.3, tStation - walkIn - (c0 + it.T)), 270);
      it.walkTo([MAAMAD_HEAD, [254.8, 331.6, 13.5], [256.6, 330.5, 13.5]], 1.1);
      it.stand(Math.max(0.05, tStation - (c0 + it.T)), 90);
      it.stand(0.3, 90, { pose: 'point' });
      it.stand(Math.max(0.3, tBack - (c0 + it.T)), 90);
      it.walkTo([[256.6, 330.5, 13.5], [254.6, 332.4, 13.5], MAAMAD_HEAD], 1.0);
      it.stand(Math.max(0.5, tEnd - (c0 + it.T)), 270);
      it.walkTo(fromPlace, 1.1);
    },
  }));
  state.troupes.push(new Troupe(state.head, { plan: () => [head], legs: (e) => e.it }));
}

// ------------------------------------------------------------------------------------------------ the metzora
function metzora(state, P, seed, sim, ctx) {
  const [w0, w1] = P.W.metzora;
  // a metzora only on the days private-offerings counts one (offerings.js: 0–1 a weekday, "rare"; one day quantile for
  // every count — CLAUDE.md); without that module this module's own draw
  const f = OFFERING_TYPES.metzora.frequency;
  const n = P.P5 ? (P.P5.counts?.metzora ?? 0) : Math.round(f.lo + dayQuantile(ctx) * (f.hi - f.lo));
  P.nMetzora = n;
  if (!n) return;
  const M = { t0: w0 };
  P.M = M;
  // the timeline (minutes from w0) — the sources give the order, the minutes are reconstruction ⚙ (g4/metzora.js)
  const T = METZORA_T;
  M.T = T;
  const G = geoOf(ctx);
  // the minutes the vessel kohen holds the altar's NE and SW corners with the asham's blood (absolute), measured on
  // private-offerings' own shared places (P5.hot — the same itinerary and places it books them by, so the two agree
  // exactly); published for G5 and the tests
  const hot = (id, r) => P.P5?.hot?.find?.((h) => h.id === id) || { c: id === 'sw' ? G.S.swPoint.pos : G.S.altarNE.pos, r, z: [15, 17.6] };
  const [sw, ne] = vesselAt(w0, [hot('sw', 1.3), hot('ne', 1.2)]);
  M.swBlood = sw; M.neBlood = ne;
  // the asham's places in the day's register: its ring, the NE and SW corners as its blood is thrown (so the chatat
  // and olah below keep clear of it; private-offerings keeps them clear in its own plan)
  const book = state.book;
  book.resource('ring:11').add(w0 + 14, w0 + 21.5, WHO);
  if (ne) book.resource('hot:ne').add(ne[0], ne[1], WHO);
  if (sw) book.resource('hot:sw').add(sw[0], sw[1], WHO);
  // ---- his chatat and olah (g4/sets.js): the first leaning a little after the oil
  const gateAt = [255.9, 330.5];
  const B0 = scriptMetzora(G, seed, METZORA_COMBOS[0], gateAt, null);
  const s0 = w0 + T.oil[1] + 0.8 - B0.sync.lean[0][0];
  const pl = placeSet(METZORA_COMBOS.map((combo) => (F) => scriptMetzora(G, seed, combo, gateAt, F)), s0, book, P.P5, G, { maxShift: 30 });
  let leans = [], atoned = w0 + T.oil[1] + 4;
  if (pl) {
    const B = pl.B;
    bookSet(B, book, P.P5, pl.hot, WHO, pl.H, pl.own);
    state.cast.assign(B, new Map());
    P.sets.push(B);
    leans = B.sync.lean.map(([a, b]) => [B.s + a, B.s + b]);
    atoned = B.s + B.sync.atoned;
    M.set = B;
  }
  M.leans = leans;
  M.atoned = atoned;
  // ---- the man: in from the Mount, to the lepers' chamber (immersion not shown), up to the gateway, the rites, the
  // leanings on his chatat and olah, then (their blood applied) into Ezrat Yisrael a while and away
  const v = 1.05;
  const gs = [255.9, 330.5, 13.5];
  const man = booked(state, w0 + T.atGate, (it) => visit(it, {
    gate: 'ce', spur: 'en', v,
    build: (it) => {
      // to the lepers' chamber (its door in the north side of the court, X 275–285 at Y 356) and its benches ⚙
      it.walkTo([EN_IN, [300, 344, 6], [281.5, 352, 6], [280.0, 358.5, 6], [266.0, 366.0, 6], [262.6, 368.6, 6]], v);
      it.stand(0.06, 90, {});
      it.stand(7.5, 90, { pose: 'sit' });                  // the bench along the west wall (1 amah: courts/en.js)
      it.walkTo([[262.6, 368.6, 6], [266.0, 366.0, 6], [280.0, 358.5, 6], [282, 352, 6], [279.5, 331.6, 6], [270.25, 331.0, 13.5], [258.2, 330.5, 13.5], [255.9, 330.5, 13.5]], v);
      it.mark = it.T;
      const c = () => w0 + T.atGate + (it.T - it.mark);    // the clock while he stands (his mark falls on the gate)
      it.stand(T.wave[0] - T.atGate, 270, { at: gs });
      it.stand(T.wave[1] - T.wave[0], 270, { at: gs, pose: 'wave' });
      it.stand(T.lean[0] - T.wave[1], 270, { at: gs });
      it.stand(T.lean[1] - T.lean[0], 270, { at: [255.6, 330.5, 13.5], pose: 'semichah' });
      it.stand(T.bohen[0] - T.lean[1], 270, { at: gs });
      // head, then hand, then foot into the gate (Negaim 14:9): a bow forward, the hand held out, a step in
      const b = T.bohen, third = (b[1] - b[0]) / 3;
      it.stand(third, 270, { at: [255.4, 330.5, 13.5], pose: 'bow', phase: (q) => 0.12 + q * 0.35 });
      it.stand(third, 270, { at: gs, pose: 'point' });
      it.stand(third, 270, { at: [255.3, 330.5, 13.5] });
      it.stand(T.oil[0] - b[1], 270, { at: gs });
      const o = T.oil;
      it.stand((o[1] - o[0]) * 0.8, 270, { at: gs });
      it.stand((o[1] - o[0]) * 0.2, 270, { at: [255.5, 330.5, 13.5], pose: 'bow', phase: (q) => 0.2 + q * 0.3 });
      // he leans on his chatat and on his olah from the gateway as each is brought before him
      for (const [l0, l1] of leans) {
        it.stand(Math.max(0.05, l0 - c()), 270, { at: gs });
        it.stand(Math.max(0.1, l1 - c()), 270, { at: [255.6, 330.5, 13.5], pose: 'semichah' });
      }
      // he waits in the gateway until their blood is applied, then goes in, purified
      it.stand(Math.max(1, atoned + 0.5 - c()), 270, { at: gs });
      it.walkTo([gs, [252.0, 329.8, 13.5], [248.6, 324.4, 13.5]], 0.9);
      it.stand(3.0, 270, { pose: 'bow', phase: (q) => (q < 0.15 ? q / 0.15 * 0.5 : q > 0.85 ? 0.5 + (q - 0.85) / 0.15 * 0.5 : 0.5) });
      it.stand(0.8, 270);
      it.walkTo([[248.6, 324.4, 13.5], [252.6, 330.8, 13.5], [258, 331.0, 13.5], ...DOWN(331.0)], 1.05);
    },
  }));
  M.it = man.it;
  M.inside = atoned + 0.5;
  // the gateway is his (and his kohanim's) from the waving until he goes in
  book.resource('gate:nikanor').add(w0 + 14.5, M.inside + 1.0, WHO);
  state.troupes.push(new Troupe(state.metzora, { plan: () => [man], legs: (e) => e.it }));
  // ---- the three kohanim: A leads the asham in by Sha'ar HaKorban and slaughters it, B (the vessel) and C (the palm,
  // the log in his left hand) out of Pinchas' door
  const at = (m) => w0 + m;
  const KA = new Itin(), KC = new Itin();
  // A: from the Korban gate's passage, across the court, to the inside of Nikanor with the lamb (lead)
  const korban = [[161.5, 401.0, 16], [161.5, 388.5, 16], [236.0, 388.5, 16], [238.6, 380, 16], [238.6, 346, 16], [241.6, 337.6, 16], [244.4, 337.0, 13.5], [246.2, 334.0, 13.5], [252.6, 330.6, 13.5]];
  KA.walkTo(korban, 1.0, { pose: 'lead_walk' });
  const aArr = KA.T;
  KA.stand(T.wave[0] - (T.atGate - 0.5), 270, { pose: 'lead' });
  KA.stand(T.wave[1] - T.wave[0], 90, { pose: 'wave' });
  KA.stand(T.lead - T.wave[1], 0, { pose: 'lead' });
  const aLead0 = KA.T;
  KA.walkTo(TO_RING, 0.9, { pose: 'lead_walk' });
  const aRing = KA.T;
  KA.stand(Math.max(0.2, T.slaughter - T.lead - (aRing - aLead0)), 270, { at: [230.4, 355.5, 16], pose: 'hold_legs' });
  KA.stand(T.blood - T.slaughter, 270, { at: [230.4, 355.5, 16], pose: 'slaughter', prop: 'knife' });
  KA.stand(0.5, 270, { at: [230.4, 355.5, 16], pose: 'stand', prop: 'knife' });
  const aLift = KA.T;
  // its hook: the lamb row of pillar 6's south face — private-offerings' lane 1, left to this rite in its window — and
  // the flaying place below it (g5/geo.js lanes) ⚙
  const L6 = geoOf(ctx).lanes[1];
  M.hook = L6.hook;
  // the slain lamb in his arms to the hook (people's lamb_slain in carry_lamb)
  KA.walkTo([...TO_HOOK.slice(0, -1), [L6.flayer[0] + 1.2, L6.flayer[1] - 0.6, 16], L6.flayer], 0.85, { pose: 'carry_lamb_walk', prop: 'lamb_slain' });
  const aHang = KA.T;
  KA.stand(0.4, 0, { pose: 'raise_hands' });
  const aFlay = KA.T;
  const tTake = w1 - w0 - 3.2;                     // the carcass dressed: off the hook and away
  KA.stand(Math.max(1, tTake - (T.atGate - 0.5) - aFlay + aArr), 0, { pose: 'flay', prop: 'knife_flay' });
  const aTake = KA.T;
  KA.walkTo([L6.flayer, [L6.flayer[0] + 1.2, L6.flayer[1] - 1.4, 16], ...TO_MEDICHIN.slice(1)], 1.0, { pose: 'carry_shoulder_walk', prop: 'lamb_carcass' });
  KA.done();
  const aT0 = at(T.atGate - 0.5) - aArr;
  M.lambT = { t0: aT0, arrive: aArr, lead0: aLead0, ring: aRing, lift: aLift, hang: aHang, take: aTake, A: KA };
  // B: out of Pinchas' door with the mizrak; waits; follows to the ring; receives; the NE and SW corners; back for the
  // oil — the shared itinerary (g4/metzora.js), so private-offerings books the corners for exactly his minutes there
  const KB = vesselKohen(T).it;
  // C: the palm and the log
  // (out of the door a few paces behind B; every stand runs to its moment on the rite's clock)
  const C0 = VESSEL_START, C_LAG = 0.25, kc0 = C0 + C_LAG;
  const until = (m) => Math.max(0.05, m - kc0 - KC.T);
  KC.walkTo([...PINCHAS, [250.6, 327.6, 13.5]], 1.1, { prop: null, left: 'oil_flask' });
  KC.stand(until(T.lead + 0.25), 300, { prop: null, left: 'oil_flask' });
  KC.walkTo([[250.6, 327.6, 13.5], ...TO_RING.slice(1, -1), [229.0, 357.2, 16]], 1.0, { prop: null, left: 'oil_flask' });
  KC.stand(until(T.slaughter), 0, { at: [229.0, 357.2, 16], prop: null, left: 'oil_flask' });
  KC.stand(until(T.blood + 0.1), 0, { at: [229.0, 357.2, 16], pose: 'receive', prop: null, left: 'oil_flask' });
  KC.walkTo([[229.0, 357.2, 16], ...[...TO_RING].reverse().slice(1, -1), [253.9, 330.5, 13.5]], 1.15, { prop: null, left: 'oil_flask' });
  KC.stand(until(T.bohen[0]), 90, { prop: null, left: 'oil_flask' });
  KC.stand(until(T.bohen[1]), 90, { pose: 'point', prop: null, left: 'oil_flask' });
  KC.stand(until(T.oil[0]), 90, { prop: null, left: 'oil_flask' });
  KC.stand(0.8, 240, { pose: 'receive' });
  // seven sprinklings toward the Kodesh HaKodashim (west), then on the same places, the rest on his head
  KC.stand(2.2, 270, { pose: 'sprinkle', phase: (q) => (q * 7) % 1 });
  KC.stand(until(T.oil[1]), 90, { pose: 'point' });
  KC.walkTo([[253.9, 330.5, 13.5], [250.8, 334.6, 13.5], ...[...PINCHAS].reverse()], 1.1);
  KC.done();
  // the lamb: driven a metre ahead of A into the court, broadside before the gate for the waving and the leaning
  // (its head within the metzora's reach), ahead of him again to its ring, bound there (Tamid 4:1) ⚙
  const LI = new Itin();
  const inL = new Route([...korban.slice(0, -1), [254.3, 330.2, 13.5]]);
  LI.walk(inL, 1.0, inL.length, (inL.length - 1.0) / (aArr * 60), { pose: 'walk_led' });
  LI.stand(Math.max(0.1, aLead0 - LI.T), 0, { pose: 'stand_halter' });
  const ringL = new Route([[254.3, 330.2, 13.5], [246.4, 333.8, 13.5], [244.4, 334.4, 13.5], [241.6, 335.6, 16], [234.0, 344.6, 16], [229.6, 351.6, 16], [229.6, 355.6, 16]]);
  LI.walk(ringL, 0, ringL.length, ringL.length / ((aRing - aLead0) * 60), { pose: 'walk_led' });
  LI.stand(Math.max(0.1, (T.slaughter - (T.atGate - 0.5)) + aArr - LI.T), 180, { pose: 'bound_tied' });
  LI.stand(0.35, 180, { pose: 'struggle' });
  LI.stand(Math.max(0.1, aLift - LI.T), 180, { pose: 'bound', turn: false });
  LI.done();
  M.lambT.L = LI;
  const kEps = [[{ t0: aT0, T: KA.T, it: KA }], [{ t0: at(C0), T: KB.T, it: KB }], [{ t0: at(C0) + C_LAG, T: KC.T, it: KC }]];
  state.troupes.push(new Troupe(state.mk, { plan: (k) => kEps[k], legs: (e) => e.it }));
  // captions at the sourced moments (only when the observer is near)
  const pos = [256, 330.5, 13.5];
  const cap = (m, key, en, he) => P.cueKeys.push({ key: `metzora:${key}:${Math.round(w0)}`, at: w0 + m, pos, text: { en, he } });
  cap(T.wave[0] + 0.1, 'wave', 'The healed metzora at Sha\'ar Nikanor: his asham lamb, alive, and the log of oil are waved before God (Vayikra 14:12; Menachot 5:6)', 'וְהֵנִיף אֹתָם תְּנוּפָה לִפְנֵי ה׳');
  cap(T.lean[0] + 0.1, 'lean', 'He may not yet enter: he leans on his asham from the gateway, his hands stretched into the court (Zevachim 33a; Rambam MK 3:11)', 'סְמִיכָה בְּשַׁעַר נִקָּנוֹר');
  cap(T.blood + 0.05, 'blood', 'Two kohanim take the blood: one in a vessel for the altar, one in his palm for the man (Negaim 14:8)', 'שְׁנֵי כֹהֲנִים מְקַבְּלִין אֶת דָּמוֹ — אֶחָד בִּכְלִי וְאֶחָד בַּיָּד');
  cap(T.bohen[0] + 0.05, 'bohen', 'He puts his head into the gate, then his hand, then his foot: blood on his right ear, thumb and big toe (Negaim 14:9)', 'הִכְנִיס רֹאשׁוֹ, יָדוֹ, רַגְלוֹ');
  cap(T.oil[0] + 0.85, 'oil', 'Oil from the log into his colleague\'s left palm, sprinkled seven times toward the Kodesh HaKodashim, then on the same places, and the rest on his head (Negaim 14:10)', 'וְהִזָּה מִן הַשֶּׁמֶן שֶׁבְּכַפּוֹ שֶׁבַע פְּעָמִים');
  if (M.leans.length) {
    cap(M.leans[0][0] - w0 + 0.1, 'chatat', 'Then his chatat and his olah are brought to the gate, and he leans on each from the gateway (Rambam Mechusrei Kapparah 4:2)', 'וְאַחַר כָּךְ יַקְרִיב חַטָּאתוֹ וְעוֹלָתוֹ');
    cap(M.atoned - w0 + 0.3, 'atoned', 'The blood of his offerings applied, the metzora goes into the court, purified (Negaim 14:7–10; Kelim 1:8)', 'וְכִפֶּר עָלָיו הַכֹּהֵן וְטָהֵר');
  }
}

/** the live asham (its own itinerary, kept in step with kohen A); then the carcass is on A's shoulder and on the hook
 * (a free prop) until he takes it away dressed */
function asham(ctx, state, sim, t, P) {
  const M = P.M;
  const L = M?.lambT;
  if (!L || !within(t, L.t0 - 0.1, L.t0 + L.A.T + 0.1)) { if (state.hungShown) { state.hung?.setVisible(false); state.hungShown = false; } return; }
  const u = t - L.t0;
  // the hung carcass from the hook until it is taken down dressed
  const hung = u >= L.hang && u < L.take;
  if (state.hung) {
    if (hung && !state.hungPlaced) {
      // its hook: the lowest row (a lamb, Tamid 4:2), on the pillar's south face beside the station ⚙
      const hk = P.M.hook || [HOOK[0] - 0.55, HOOK[1] - 0.6, 19.2];
      state.hung.setSite?.(hk[0], hk[1], hk[2]);
      state.hung.setHeading?.(180);
      state.hungPlaced = true;
    }
    if (hung !== !!state.hungShown) { state.hung.setVisible(hung); state.hungShown = hung; }
  }
  if (u >= L.lift || u < 0) return;
  const lamb = state.lamb.slot(0), kA = state.mk.slot(0);
  const s = state.s2;
  L.L.sample(u, s);
  lamb.place(s.X, s.Y, s.Z).heading(s.heading);
  if (s.walking) lamb.pose('walk_led', stride(ctx, lamb, 'walk_led', s.m));
  else lamb.pose(s.pose, s.phase == null ? undefined : s.phase);
  const lead = s.walking || s.pose === 'stand_halter';
  if (lamb.actor?.setLead && kA.actor && lamb._lead !== lead) { lamb._lead = lead; lamb.actor.setLead(lead ? kA.actor : null, 'right'); }
  lamb.show();
}

// ------------------------------------------------------------------------------------------------ the birds
/**
 * The bird offerings of these sets are private-offerings' (G5): its kohen takes the pair at the gate and offers them at
 * the altar. When its plan is there, every mother (or zav / zavah) of its yoledet and zav-zavah jobs is staged here: up
 * from the Mount with the birds, handing them to that kohen at his moment, then standing in the gateway until her
 * birds are offered (Sotah 1:5). Without it (its module missing), this module plans its own and has its own two
 * kohanim carry the birds to the altar's SW corner.
 */
function purifications(state, P, seed, sim, ctx) {
  // with private-offerings present its bird jobs are the day's (none when its plan has no individual offerings)
  if (P.P5) { if (P.P5.ok) purificationsG5(state, P, seed, sim, P.P5); return; }
  return purificationsOwn(state, P, seed, sim, ctx);
}

function purificationsG5(state, P, seed, sim, g5) {
  const [w0, w1] = P.W.purif;
  const jobs = [];
  for (const inst of g5.insts || []) {
    const set = inst.job?.set;
    if (inst.kind !== 'bird' || (set !== 'yoledet' && set !== 'zav-zavah')) continue;
    // the kohen is at the gate holding the birds from s + 0.5 (g5/plan.js scriptBird: arriveAt …, 0.5)
    const tHand = inst.s + 0.5;
    let tDone = tHand + 3;
    for (const st of inst.steps || []) if (st.id === 'melikah' || st.id === 'haktarah') tDone = Math.max(tDone, st.t1);
    jobs.push({ inst, set, tHand, tDone: Math.min(tDone, tHand + 25), lane: inst.lane ?? 1, i: jobs.length, species: inst.species });
  }
  jobs.sort((a, b) => a.tHand - b.tHand);
  const nW = state.women.count, nZv = state.zavim.count;
  const freeAt = { w: new Array(nW).fill(-1e9), z: new Array(nZv).fill(-1e9) };
  const spotFree = new Array(GATE_SPOTS.length).fill(-1e9);
  const eps = { w: Array.from({ length: nW }, () => []), z: Array.from({ length: nZv }, () => []) };
  for (const j of jobs) {
    const woman = j.set === 'yoledet' || rand(seed, 'zw', j.i) < 0.45;
    const pool = woman ? 'w' : 'z';
    const v = woman ? 1.05 + 0.1 * rand(seed, 'pv', j.i) : 1.2;
    // while the metzora's rites hold the middle of the gateway, a middle-lane hand-over is made from beside him ⚙
    const metzBusy = P.M && j.tHand > P.M.t0 + 13 && j.tHand < (P.M.inside ?? P.M.t0 + 45) + 1;
    const gateY = 330.5 + (j.lane - 1) * 1.6 - (metzBusy && j.lane === 1 ? 1.9 : 0);
    const hand = [Math.min(255.7, 252.8 + 2.6), gateY, 13.5];
    let si = -1;
    for (let k = 0; k < GATE_SPOTS.length; k++) if (spotFree[k] < j.tHand) { si = k; break; }
    const sp = si >= 0 ? GATE_SPOTS[si] : null;
    const birds = j.species === 'pigeon' ? 'bird_cage_pigeons' : 'bird_cage';
    const lane = gateY < 330.5 ? 329.4 : 331.6;
    // up from the Mount (booked there), timed so that she reaches the kohen as he takes the birds
    const r = fitAt(state.book, WHO, j.tHand, (mp) => {
      const it = new Itin();
      it.mp = mp;
      visit(it, {
        gate: 'ce', spur: 'en', v, prop: birds, hand: 'left',
        build: (it) => {
          it.walkTo([...UP(lane), [262.0, lane, 13.5], hand], v * 0.9, { prop: birds, hand: 'left' });
          it.mark = it.T;
          it.stand(0.3, 270, { pose: 'carry', prop: birds });                 // handed to the kohen (Sotah 1:5)
          const at = sp || hand;
          if (sp) it.walkTo([hand, sp], 0.6);
          it.stand(Math.max(1, j.tDone - j.tHand - 0.3 - (sp ? 0.1 : 0)), 270, { at });
          it.walkTo([at, [263, lane, 13.5], ...DOWN(lane)], v);
        },
      }).done();
      // until the hand-over the birds are in her hands; after it, empty-handed all the way home
      for (const g of it.legs) if (g.t0 >= it.mark + 0.29) g.prop = null;
      return it;
    });
    const it = r.it, t0 = r.t0;
    if (t0 + it.T > w1 + 25) { release(it.mp); continue; }
    const slots = freeAt[pool];
    let k = -1;
    for (let q = 0; q < slots.length; q++) if (slots[q] < t0 - 0.5) { k = q; break; }
    if (k < 0) { release(it.mp); continue; }
    slots[k] = t0 + it.T;
    if (si >= 0) spotFree[si] = j.tDone + 0.3;
    eps[pool][k].push({ t0, T: it.T, it });
    P.arrivals.push({ t: j.tHand, zav: j.set === 'zav-zavah', woman, spot: si, g5: j.inst.id });
  }
  state.troupes.push(new Troupe(state.women, { plan: (k) => eps.w[k], legs: (e) => e.it }));
  state.troupes.push(new Troupe(state.zavim, { plan: (k) => eps.z[k], legs: (e) => e.it }));
  P.g5 = true;
}

function purificationsOwn(state, P, seed, sim, ctx) {

  const [w0, w1] = P.W.purif;
  const q = dayQuantile(ctx);
  // OFFERING_TYPES frequency: yoledet 15–45 a weekday in Cheshvan, zav-zavah 2–10 — one day quantile for both ⚙
  const nY = Math.round(15 + 30 * q), nZ = Math.round(2 + 8 * q);
  const list = [];
  for (let i = 0; i < nY + nZ; i++) list.push({ zav: i >= nY, i });
  // arrival times spread over the window (seeded), the first a few minutes in, the last early enough to be done
  const span = w1 - w0 - 26;
  list.forEach((a) => { a.t = w0 + 3 + span * rand(seed, 'pa', a.i); a.stay = 6 + 12 * rand(seed, 'ps', a.i); a.woman = !a.zav || rand(seed, 'zw', a.i) < 0.45; a.birds = rand(seed, 'pb', a.i) < 0.5 ? 'bird_cage' : 'bird_cage_pigeons'; });
  list.sort((a, b) => a.t - b.t);
  // the metzora's rites hold the gateway: no one else stands there meanwhile
  const metz = P.W.metzora ? [P.W.metzora[0] + 12, P.W.metzora[1] - 6] : null;
  const nW = tierCount(sim, state.women.count, 3, 0.5), nZv = state.zavim.count;
  const freeAt = { w: new Array(nW).fill(-1e9), z: new Array(nZv).fill(-1e9) };
  const spotFree = new Array(GATE_SPOTS.length).fill(-1e9);
  const eps = { w: Array.from({ length: state.women.count }, () => []), z: Array.from({ length: nZv }, () => []) };
  const kFree = [-1e9, -1e9];
  const kEps = [[], []];
  for (const a of list) {
    const pool = a.woman ? 'w' : 'z';
    const v = a.woman ? 1.05 + 0.1 * rand(seed, 'pv', a.i) : 1.2;
    // build to know how long it takes to reach the gate; find a free slot, spot and kohen
    const probe = birdItin(a, 0, v, 0, a.stay);
    let tGate = a.t + probe.toGate;
    if (metz && tGate + a.stay > metz[0] && tGate < metz[1]) tGate = metz[1] + rand(seed, 'pm', a.i) * 4;
    let si = -1;
    for (let j = 0; j < GATE_SPOTS.length; j++) if (spotFree[j] < tGate - 0.3) { si = j; break; }
    if (si < 0) continue;
    const slots = freeAt[pool];
    const t0 = tGate - probe.toGate;
    let k = -1;
    for (let j = 0; j < slots.length; j++) if (slots[j] < t0 - 1) { k = j; break; }
    if (k < 0) continue;
    if (tGate + a.stay + probe.toGate + 9 > w1 + 25) continue;
    const r = fitAt(state.book, WHO, tGate, (mp) => { const b = birdItin(a, si, v, k, a.stay, mp); b.it.mark = b.toGate; return b.it; });
    spotFree[si] = tGate + a.stay;
    slots[k] = r.t0 + r.it.T;
    eps[pool][k].push({ t0: r.t0, T: r.it.T, it: r.it });
    P.arrivals.push({ t: tGate, zav: a.zav, woman: a.woman, spot: si });
    // the gate kohen who takes the birds: the one free soonest
    const tHand = tGate + 0.5;
    const kk = kFree[0] <= kFree[1] ? 0 : 1;
    if (kFree[kk] < tHand - 0.2) {
      const ke = gateKohen(kk, si, a.birds);
      kEps[kk].push({ t0: tHand - ke.mark, T: ke.it.T, it: ke.it });
      kFree[kk] = tHand - ke.mark + ke.it.T;
      P.handovers.push({ t: tHand, key: `birds:${Math.round(tHand * 10)}`, pos: GATE_SPOTS[si] });
    }
  }
  state.troupes.push(new Troupe(state.women, { plan: (k) => eps.w[k], legs: (e) => e.it }));
  state.troupes.push(new Troupe(state.zavim, { plan: (k) => eps.z[k], legs: (e) => e.it }));
  // the gate kohanim between handovers: standing just inside the gate (in from Pinchas' door at the start, out at the end)
  for (let kk = 0; kk < 2; kk++) kEps[kk] = fillKohen(kk, kEps[kk], w0, w1);
  state.troupes.push(new Troupe(state.nk, { plan: (k) => kEps[k], legs: (e) => e.it }));
}

/** one mother (or zav / zavah): up from the Mount with the birds, hands them in, stands in the gateway, goes home */
function birdItin(a, si, v, k, stay, mp = null) {
  const sp = GATE_SPOTS[si];
  const lane = sp[1] < 330.5 ? 329.4 : 331.6;
  let toGate = 0;
  const it0 = new Itin();
  it0.mp = mp;
  const it = visit(it0, {
    gate: 'ce', spur: 'en', v, prop: a.birds, hand: 'left',
    build: (it) => {
      it.walkTo([...UP(lane), [262.5, lane, 13.5], sp], v * 0.9, { prop: a.birds, hand: 'left' });
      toGate = it.T;
      it.stand(0.5, 270, { prop: a.birds, hand: 'left' });
      it.stand(0.35, 270, { pose: 'carry', prop: a.birds });          // handed to the kohen
      it.stand(Math.max(1, stay - 0.85), 270, { prop: null });
      it.walkTo([sp, [263, lane, 13.5], ...DOWN(lane)], v, { prop: null });
    },
  }).done();
  // the visit walks the first part with the birds in hand; after the handover empty-handed
  for (const g of it.legs) if (g.t0 >= toGate + 0.5) g.prop = null;
  return { it, toGate };
}

/** a gate kohen: steps to the gateway, takes the birds, carries them to the SW corner, sets them down, comes back */
function gateKohen(kk, si, birds) {
  const post = KOHEN_POSTS[kk], sp = GATE_SPOTS[si];
  const it = new Itin();
  const reach = [Math.min(255.6, sp[0] - 1.1), sp[1], 13.5];
  it.walkTo([post, reach], 1.0);
  const mark = it.T;
  it.stand(0.4, 90, { pose: 'carry', prop: birds });
  it.walkTo([reach, ...TO_SW], 1.15, { pose: 'carry_walk', prop: birds });
  it.stand(0.35, 300, { pose: 'kneel', phase: (q) => q, prop: birds });
  it.walkTo([...[...TO_SW].reverse(), post], 1.15);
  it.stand(0.1, 90);
  it.done();
  return { it, mark };
}

/** between handovers the gate kohen stands at his post: fill the gaps with standing episodes; in and out by Pinchas' door */
function fillKohen(kk, list, w0, w1) {
  const post = KOHEN_POSTS[kk];
  list.sort((a, b) => a.t0 - b.t0);
  const out = [];
  // arrival from Pinchas' door at the window's start
  const arr = new Itin();
  arr.walkTo([...PINCHAS, post], 1.1);
  let t = w0 + 0.3 + kk * 0.4;
  const first = { t0: t, it: arr };
  arr.stand(0.05, 90);
  first.T = arr.T;
  out.push(first);
  t += arr.T;
  for (const e of list) {
    if (e.t0 > t + 0.02) { const it = new Itin(); it.stand(e.t0 - t, 90, { at: post }); it.done(); out.push({ t0: t, T: it.T, it }); }
    if (e.t0 >= t - 0.02) { out.push(e); t = e.t0 + e.T; }
  }
  const tEnd = w1 + 1 + kk * 0.5;
  if (tEnd > t) { const it = new Itin(); it.stand(Math.max(0.1, tEnd - t), 90, { at: post }); it.walkTo([post, ...[...PINCHAS].reverse()], 1.1); it.done(); out.push({ t0: t, T: it.T, it }); }
  return out;
}

// ------------------------------------------------------------------------------------------------ cues
function cues(ctx, state, sim, t, P) {
  if (!sim.crossing.ok) return;
  for (const c of P.cueKeys) {
    if (!crossed(state, c.at)) continue;
    sim.cueAt(c.key, c.at, () => { if (observerNear(ctx, c.pos, CAPTION_RANGE)) sim.caption(c.text, { id: 'nikanor', duration: 7 }); });
  }
  // the metzora's chatat and olah: the bleat at each binding, the libations' wine (g4/sets.js)
  for (const B of P.sets) for (const c of B.cues) {
    if (!crossed(state, c.t)) continue;
    sim.cueAt(`set:${B.role}:${c.key || c.id}:${Math.round(c.t * 10)}`, c.t, () => {
      if (!observerNear(ctx, c.pos, c.kind === 'sound' ? 60 : (c.range || 30))) return;
      if (c.kind === 'sound') sim.sound(c.id, c.pos, c.opts);
      else sim.caption(c.text, { id: 'nikanor', duration: 6 });
    });
  }
  for (const h of P.handovers) {
    if (!crossed(state, h.t + 0.1)) continue;
    sim.cueAt(h.key, h.t + 0.1, () => {
      if (!observerNear(ctx, h.pos, CAPTION_RANGE)) return;
      sim.sound('doves', [h.pos[0], h.pos[1], h.pos[2] + 2.5], { gain: 0.6 });
    });
  }
}

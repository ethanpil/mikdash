// The work of the chambers (group G4). Events served (choreo 'chambers-daily'):
//   chavitin-bakers  in their chamber beside Nikanor (Middot 1:4) the bakers knead, shape and fry the Kohen Gadol's
//                    daily chavitin — a whole isaron measured, halved, twelve cakes on the griddle with oil (Menachot
//                    4:5; Rambam TuM 3:18–19); set to work as the dawn inspection reaches them (Tamid 1:3), the cakes
//                    out to the morning service before the limbs go to the ramp (Yoma 33a). Daily, Shabbat too
//                    (Menachot 11:3).
//   wood-chamber     the north-east chamber of Ezrat Nashim: kohanim with blemishes, in their own clothes (unfit to
//                    serve), pick over the altar wood; a log with a worm is unfit (Middot 2:5).
//   nazirites        a nazir at the end of his term (as many as private-offerings counts for the day — none on many
//                    days): in by Sha'ar HaKorban with a ewe lamb, a lamb and a ram and a basket of twenty loaves; he
//                    leans on each and slaughters it — the chatat first, then the olah, then the shelamim — and their
//                    blood, limbs and eimurim are offered (g4/sets.js, after G5's staging of an animal); then he is
//                    shaved in the nazirites' chamber, the south-east chamber of Ezrat Nashim (Rambam Nezirut 8:2–3;
//                    Middot 2:5); the ram's meat is cooked there and he casts his hair under the pot with some of its
//                    broth (Nazir 6:8); a kohen takes the cooked foreleg and a loaf and a wafer and, with the breast,
//                    the thigh and the eimurim, they are waved on his palms east of the altar (Nazir 6:9; Rambam MK
//                    9:9). Hearth 'courts.en.nazirites.hearth'.
//   golah-wheel      Lishkat HaGolah: the wheel over the cistern turned, the court's water drawn (Middot 5:4; Eruvin
//                    10:14 — Shabbat too). Movable 'wheel:azarah.chamber.golah' (spin).
//   parvah           Lishkat HaParvah: the hides of the most-holy offerings salted (Middot 5:3), salt fetched from
//                    Lishkat HaMelach next door.
//   beit-garmu       Friday: the house of Garmu bakes the showbread (Shekalim 5:1; Menachot 11:2, 11:9) — kneaded and
//                    shaped in Beit HaMoked's chol half, baked in the showbread chamber in its kodesh half (Middot 1:6).
//   seals            evening: Achiyah brings out the day's seals and Yochanan ben Pinchas pays coin for each
//                    (Shekalim 5:4), before the chamber of seals in Beit HaMoked (Tamid 3:3).
// Who comes from where: Israelites and the blemished kohanim in their own clothes up from the city over the Mount
// (g4/mount.js, booked in the day's G4 register); kohanim in the holy garments never cross the Mount — they come
// from inside the precinct (Beit HaMoked, the door of Pinchas' chamber: "the holy garments are not worn out into the
// city", Yechezkel 44:19). Fires and the wheel are pure functions of t; the module is `always` so that they are
// right after any jump (the nazirites' hearth burns only while a nazir's pot is on).
import { smooth, rand, within, since } from '../lib/core.js';
import { crossed } from '../lib/cue.js';
import { Itin, Troupe, Follower, daySeed, dayQuantile, tierCount, win, hm, observerNear, norm } from './g4/lib.js';
import { visit, arrive, leave, fitAt, mpOf, release, bestEntry, SPURS } from './g4/mount.js';
import { g4Book, planBefore } from './g4/book.js';
import { geoOf, scriptNazir, scriptWaving, placeSet, bookSet, SetCast, g5PlanOf, setsSource, entryBack, NAZIR_COMBOS } from './g4/sets.js';
import { OFFERING_TYPES } from '../../data/offerings.js';

const SEED = 0x6368;
const WHO = 'chambers-daily';
const CAPTION_RANGE = 25;
const NAZ_FIRE = 'courts.en.nazirites.hearth';
const CHAV_FIRE = 'sim.chambers.chavitin';
const WHEEL = 'wheel:azarah.chamber.golah';
const DOOR_CHEL = 'azarah.moked.door-chel';
// Pinchas' chamber door to Ezrat Yisrael (kohanim dressed by Pinchas haMalbish come out of it — Shekalim 5:1) ⚙
const PINCHAS = [[251.5, 341.5, 13.5], [246.6, 341.5, 13.5], [246.0, 337.0, 13.5]];
// the chavitin chamber (courts/nikanor.js): its door to Ezrat Yisrael at X 248, Y 317.5–321.5; hearth with the iron
// griddle along its south wall (X 250–253.5); kneading table X 254.5–258, Y 318.5–320.5
const CHAV = {
  door: [[246.2, 319.5, 13.5], [249.4, 319.5, 13.5]],
  knead: { at: [256.4, 317.7, 13.5], face: 0 },
  griddle: { at: [252.9, 318.25, 13.5], face: 190 },
  measure: { at: [253.95, 319.6, 13.5], face: 90 },
  fire: [251.75, 316.5, 14.6],
};
// the wood store (courts/en.js woodStore): piles along the N and E walls, a low sorting pile, loose logs ⚙
const WOOD = {
  door: [[375, 352.5, 6], [375, 359.5, 6]],
  sit: { at: [369.4, 373.6, 6.2], face: 180 },              // on the low pile (top +1.2)
  kneel: { at: [376.6, 374.8, 6], face: 330 },                // north of the carriers' way ⚙
  pile: [377.8, 392.6, 6], floor: [372.4, 371.0, 6], floor2: [373.9, 369.9, 6], stack: [389.8, 372.6, 6], reject: [360.0, 363.0, 6],
};
// the nazirites' chamber (courts/en.js naziritesKitchen): a raised hearth bench along the east wall (X 389.1–392.1,
// top 1.4 above the floor) with three pots over fire-pits at Y 275, 282, 289; stone benches along the south wall
// (0.9 high) ⚙. Who tends a pot stands on the floor west of the hearth bench (X 388.3).
const NAZ = {
  door: [[375, 309, 6], [375, 302, 6]],
  pits: [[390.6, 275], [390.6, 282], [390.6, 289]],
  bench: [[385.6, 264.2], [382.2, 264.2], [365.0, 264.2]],
  tend: 388.3,
  fireZ: 7.48,
};
// the hearth's own fire is under the middle pot (courts.en.nazirites.hearth); the other two pots get a stand-in fire
// each until build-courts lights them (requested) ⚙
const NAZ_PIT_FIRES = ['sim.chambers.nazirites.0', null, 'sim.chambers.nazirites.2'];
// from the foot of the fifteen steps across Ezrat Nashim to the nazirites' chamber door (and back) ⚙
const STEP_FOOT = [278.6, 330.5, 6];
const TO_NAZ = [STEP_FOOT, [300, 324.5, 6], [360, 321, 6], [375, 309, 6], [375, 302, 6]];
// Lishkat HaGolah: the curb round the cistern mouth, the posts, the hand-wheel at X 95.1 (courts/chambers.js golah)
const GOLAH = {
  door: [[96.5, 377.5, 16], [93.0, 379.6, 16], [93.0, 382.6, 16]],
  wheel: { at: [96.35, 384.35, 16], face: 268 },
  curb: { at: [93.0, 382.95, 16], face: 0 },
  outside: [99.5, 378.0, 16],
};
// Lishkat HaParvah (hide racks at Y 265.5, 268.5, 271.5) and Lishkat HaMelach (salt bins along its south wall)
const PARVAH = {
  door: [[130.25, 279.5, 16], [130.25, 274.0, 16]],
  salters: [{ at: [126.2, 267.1, 16], face: 180 }, { at: [134.4, 269.9, 16], face: 0 }],
  rack: { at: [132.6, 273.4, 16], face: 180 },        // east of the doorway's line ⚙
  melach: [[118.0, 279.5, 16], [85.0, 279.5, 16], [85.0, 273.4, 16], [85.0, 268.6, 16]],
};
// Beit HaMoked: the showbread chamber (SE, kodesh) with its oven; the hall's chol half north of the kodesh line (Y 402):
// the kneading and the shaping there, the baking inside (Menachot 11:2)
const GARMU = {
  oven: { at: [216.9, 393.55, 16], face: 90 },
  door: [217.0, 399.2, 16],
  kneaders: [{ at: [213.6, 404.9, 16], face: 100 }, { at: [216.2, 405.6, 16], face: 260 }],
  shaper: { at: [218.4, 403.4, 16], face: 200 },
};
// from Pinchas' door over the duchan, north along Ezrat Kohanim and through the Moked gate into the hall ⚙
const TO_MOKED = [[251.5, 341.5, 13.5], [246.6, 341.5, 13.5], [245.0, 338.8, 13.5], [244.4, 337.6, 13.5], [241.6, 335.8, 16], [240.6, 352, 16], [240.6, 387.4, 16], [216, 387.6, 16], [210.75, 388.6, 16], [210.75, 395.5, 16]];
const SEALS = { door: [217.0, 405.2, 16], achiyah: { at: [213.7, 403.2, 16], face: 75 }, yochanan: { at: [215.5, 403.6, 16], face: 255 }, inside: [217.0, 408.2, 16] };
// the shaven nazir: the people system has no shaven head yet (requested) — he is drawn from the moment the shaving is
// done as an Israelite with his head covered, from a seed whose skin, greying, build and face match the nazir's ⚙
const SHAVEN_SEEDS = [197784, 274650, 152485];

export default {
  id: 'chambers-daily',
  always: true,
  lead: 12,
  lag: 12,
  importance: 1,

  init(ctx, events, sim) {
    sim.setBounds([60, 255, -30], [400, 420, 46]);
    const P = (name, role, count, seed, imp = 1, prop = null) => sim.pool({ name, role, count, seed: SEED + seed, importance: imp, prop });
    const state = {
      bakers: P('chavitin-bakers', 'kohen', 3, 1),
      wood: P('wood-sorters', 'kohen_offduty', 4, 2),
      nazir: P('nazirites', 'nazir', 3, 3, 2),
      shaven: SHAVEN_SEEDS.map((s, i) => P(`nazirites-shaven-${i}`, 'israelite', 1, s, 2)),
      comp: P('nazir-companions', 'israelite', 6, 5, 2),
      setK: P('set-kohanim', 'kohen', 18, 6, 2),
      setLamb: sim.pool({ name: 'set-lambs', animal: 'lamb', count: 4, seed: SEED + 11, importance: 2 }),
      setRam: sim.pool({ name: 'set-rams', animal: 'ram', count: 2, seed: SEED + 12, importance: 2 }),
      golah: P('golah-levites', 'levi', 2, 7),
      parvah: P('hide-salters', 'kohen', 3, 8),
      garmu: P('beit-garmu', 'kohen', 4, 9),
      seals: P('seals', 'israelite', 2, 10),
      nazLevel: 0,
      chav: null, chavLevel: 0,
      wheel: ctx.movables?.get?.(WHEEL) || null, wheelA: NaN,
      doorChel: sim.door(DOOR_CHEL),
      plan: null, planGen: -1, troupes: [],
      fmt: (m) => ctx.time?.format?.(m) ?? hm(m),
      baskets: [],
      pitFires: [null, null, null],
    };
    NAZ_PIT_FIRES.forEach((id, k) => {
      if (!id) return;
      try { state.pitFires[k] = ctx.fx?.add?.({ id, kind: 'hearth', pos: [NAZ.pits[k][0], NAZ.pits[k][1], NAZ.fireZ], size: 0.3, intensity: 0, schedule: 'always', smoke: true }) || null; } catch { state.pitFires[k] = null; }
    });
    state.cast = new SetCast(ctx, { kohen: state.setK, lamb: state.setLamb, ram: state.setRam, nazir: state.nazir, companion: state.comp });
    // the bakers' fire under the griddle — a stand-in until build-courts lights the bakery's hearth (requested) ⚙
    try { state.chav = ctx.fx?.add?.({ id: CHAV_FIRE, kind: 'hearth', pos: CHAV.fire, size: 0.28, intensity: 0, schedule: 'always', smoke: false }) || null; } catch { state.chav = null; }
    // the nazir's offerings as watchable rows ("Happening now", the map), under the nazirites' event
    try { state.offSource = ctx.schedule?.addSource?.(setsSource(ctx, 'g4-nazir', () => plan(ctx, state, sim).sets)); } catch (e) { console.warn('[sim:g4] source failed', e); }
    return state;
  },

  /** the day's plan (g4/book.js: after courts-daily and sanhedrin, before nikanor-stations) */
  plan(ctx, state, sim) { return plan(ctx, state, sim); },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, state, sim);
    for (const tr of state.troupes) tr.update(ctx, sim, t, tr.cb);
    state.cast.update(sim, t, dt);
    poseBaskets(ctx, state, P, t);
    // fires (shared wants, sim.fireWant) and the wheel
    // the nazirites' pots: the middle one's fire is the builder's hearth — cold unless a set is cooking (this module is
    // `always`, so it always states that want) — the others the stand-ins (added at 0, wanted only while they burn)
    const naz = P.nazFire ? P.nazFire(t, 1) : 0;
    state.nazLevel = sim.fireWant(NAZ_FIRE, naz);
    for (const k of [0, 2]) {
      const v = P.nazFire ? P.nazFire(t, k) : 0;
      if (v > 0 && NAZ_PIT_FIRES[k]) sim.fireWant(NAZ_PIT_FIRES[k], v);
    }
    const ch = P.W.chav && within(t, P.W.chav[0] - 2, P.W.chav[1] + 1) ? smooth(P.W.chav[0] - 1, P.W.chav[0] + 3, t) * (1 - smooth(P.W.chav[1] - 25, P.W.chav[1] - 10, t)) * 0.8 : 0;
    state.chavLevel = ch;
    if (ch > 0) sim.fireWant(CHAV_FIRE, ch);
    const a = P.wheelAngle(t);
    if (!state.wheel) state.wheel = ctx.movables?.get?.(WHEEL) || null;
    if (state.wheel?.userData?.spin && !(Math.abs(a - state.wheelA) <= 1e-4)) { state.wheel.userData.spin(a); state.wheelA = a; }
    // Beit HaMoked's door to the chel opens for those who come and go by it
    let dw = 0;
    for (const x of P.chelPass) { const d = t - x; if (d > -0.15 && d < 0.2) dw = Math.max(dw, smooth(-0.15, -0.07, d) * (1 - smooth(0.12, 0.2, d))); }
    if (dw > 0) state.doorChel.set(dw);
    if (sim.crossing.ok) cues(ctx, state, sim, t, P);
  },

  release(ctx, state) {
    state.cast?.hide();
    for (const b of state.baskets) if (b?.on) { b.on = false; b.a.setVisible(false); }
  },

  dispose(ctx, state) { try { state.chav?.remove?.(); for (const f of state.pitFires) f?.remove?.(); } catch { /* fx gone */ } state.cast?.dispose(); for (const b of state.baskets) b?.a?.dispose?.(); },

  debug(s) {
    const P = s.plan;
    if (!P) return 'no plan';
    return `nazirites ${P.nNaz ?? 0} (${P.nazSource || '-'}): ${P.naz.map((n) => s.fmt(n.t0)).join(' ') || '-'} · wheel ${(s.wheelA / (2 * Math.PI)).toFixed(2)} turns · naz fire ${s.nazLevel.toFixed(2)} · chavitin fire ${s.chavLevel.toFixed(2)}${s.cast?.missing ? ` · ${s.cast.missing} set figures over the pools` : ''}`;
  },
};

// ================================================================================================ the plan
function plan(ctx, state, sim) {
  if (state.plan && state.planGen === sim.generation && state.planDate === ctx.time?.dateString) return state.plan;
  planBefore(ctx, sim, WHO);
  const book = g4Book(ctx, sim);
  book.dropOwner(WHO);
  const seed = daySeed(ctx, SEED);
  const W = {
    chav: win(sim, 'chavitin-bakers'), wood: win(sim, 'wood-chamber'), naz: win(sim, 'nazirites'), golah: win(sim, 'golah-wheel'),
    parvah: win(sim, 'parvah'), garmu: win(sim, 'beit-garmu'), seals: win(sim, 'seals'),
  };
  const P = { W, seed, naz: [], cues: [], chelPass: [], nazFire: null, wheelAngle: () => 0, sets: [], baskets: [] };
  state.troupes = [];
  state.cast.reset();
  if (W.chav) chavitin(state, P, seed, sim);
  if (W.wood) wood(state, P, seed, sim, book);
  if (W.naz) nazirites(state, P, seed, sim, ctx, book);
  if (W.golah) golah(state, P, seed, sim, book);
  if (W.parvah) parvah(state, P, seed, sim, ctx);
  if (W.garmu) garmu(state, P, seed, sim);
  if (W.seals) seals(state, P, seed, sim, book);
  for (const tr of state.troupes) tr.replan(sim.generation);
  state.plan = P;
  state.planGen = sim.generation;
  state.planDate = ctx.time?.dateString;
  return P;
}

/** a visit from the city booked on the Mount, timed so that its it.mark falls on `target` */
const booked = (book, target, build) => { const r = fitAt(book, WHO, target, (mp) => { const it = new Itin(); it.mp = mp; build(it); it.done(); return it; }); return { t0: r.t0, T: r.it.T, it: r.it }; };

/** alternating work poses at a place until `min` is filled (seeded); poses: [[pose, prop, weight, phase?]] */
function workAt(it, min, at, face, poses, seed, key) {
  let left = min, n = 0;
  const wsum = poses.reduce((s, p) => s + p[2], 0);
  while (left > 0.05 && n < 2000) {
    let x = rand(seed, key, n) * wsum, p = poses[0];
    for (const q of poses) { x -= q[2]; if (x <= 0) { p = q; break; } }
    const d = Math.min(left, 0.7 + 2.6 * rand(seed, key, n, 'd'));
    it.stand(d, face + (rand(seed, key, n, 'h') - 0.5) * 16, { at, pose: p[0], prop: p[1], phase: p[3] ?? null, turn: n === 0 });
    left -= d; n++;
  }
}

/** a route of G5's walking graph as Itin points */
const graphPts = (G, a, b, o) => G.route(a, b, o).path.points.map((p) => [p.X, p.Y, p.Z]);

// ------------------------------------------------------------------------------------------------ chavitin
function chavitin(state, P, seed, sim) {
  const [w0, w1] = P.W.chav;
  // Before dawn the Mount's gates are shut: the bakers are kohanim of the beit av who came into the court with the
  // inspection. They are in their dark chamber when the inspection's officer brings the torches in to set them to
  // work (torch-inspection, g1/plan.js — he stands just inside the door); their posts keep clear of him and of the
  // tamid's bearers, who take the flour, the chavitin and the wine from inside the chamber before the limbs go to the
  // ramp (g2/tamid.js — at X 251, Y 318.9–320.1) ⚙
  const insp = sim.event('torch-inspection');
  const tIn = insp && Number.isFinite(insp.t0) ? insp.t0 + 0.5 : w0 - 12;
  const limbs = sim.event('limbs-to-ramp');
  const tLay = Math.min(w1 - 20, (limbs && Number.isFinite(limbs.t0) ? limbs.t0 : w1 - 54) - 6);
  const posts = [CHAV.knead, CHAV.griddle, CHAV.measure];
  const out = [...CHAV.door].reverse().concat([...PINCHAS].reverse());
  const planFn = (k) => {
    const S = posts[k];
    const it = new Itin();
    it.stand(Math.max(0.5, w0 + 0.3 + 0.2 * k - tIn), S.face, { at: S.at, pose: 'stand' });      // waiting in the dark
    const t0w = it.T, min = Math.max(1, w1 - 0.6 - 0.3 * k - (tIn + t0w));
    if (k === 0) workAt(it, min, S.at, S.face, [['kemitzah', 'bowl', 3], ['stand', 'bowl', 1]], seed, 'kn');
    else if (k === 1) workAt(it, min, S.at, S.face, [['pour', 'oil_flask', 2], ['kemitzah', null, 2], ['stand', null, 1]], seed, 'gr');
    else {
      // the whole isaron measured and halved (Menachot 4:5) — then the cakes from the griddle to the table; the morning
      // six laid ready on the table for the tamid's bearer
      const upto = Math.max(1, tLay - (tIn + it.T));
      workAt(it, Math.min(upto, 14), S.at, S.face, [['pour', 'solet', 2], ['stand', 'solet', 1]], seed, 'me');
      let n = 0;
      while (tIn + it.T < tLay - 2 && n < 200) {
        it.walkTo([S.at, [254.3, 318.0, 13.5]], 0.8, { prop: null });
        it.stand(0.35, 200, { pose: 'kemitzah' });
        it.walkTo([[254.3, 318.0, 13.5], S.at], 0.8, { pose: 'carry_walk', prop: 'chavitin' });
        it.stand(0.4 + rand(seed, 'cw', n), S.face, { pose: 'carry', prop: 'chavitin' });
        it.stand(1.4 + 2 * rand(seed, 'cs', n), S.face, { pose: 'stand' });
        n++;
      }
      it.stand(Math.max(0.2, tLay - (tIn + it.T)), S.face, { pose: 'carry', prop: 'chavitin' });
      it.stand(0.3, S.face, { pose: 'bow', phase: (q) => q * 0.6 });       // laid on the table
      workAt(it, Math.max(0.5, w1 - 0.6 - 0.6 - (tIn + it.T)), S.at, S.face, [['stand', null, 2], ['kemitzah', null, 1]], seed, 'm2');
    }
    it.walkTo([S.at, ...out], 1.05);
    it.done();
    return [{ t0: tIn, T: it.T, it }];
  };
  state.troupes.push(new Troupe(state.bakers, { plan: planFn, legs: (e) => e.it }));
}

// ------------------------------------------------------------------------------------------------ the wood store
function wood(state, P, seed, sim, book) {
  const [w0, w1] = P.W.wood;
  const n = tierCount(sim, 4, 3, 0.75);
  const eps = [];
  for (let k = 0; k < 4; k++) {
    if (k >= n) { eps.push([]); continue; }
    const tA = w0 + 0.5 * k, tL = w1 - 0.4 * k;
    eps.push([booked(book, tA, (it) => visit(it, {
      gate: 'ce', spur: 'en', v: 1.2,
      build: (it) => {
        const inWay = [[393, 332, 6], [378, 344, 6], ...WOOD.door];
        if (k === 0) {
          it.walkTo([...inWay, [369.4, 372.4, 6]], 1.1);
          it.mark = it.T;
          // sits on the low pile turning a log over, looking for worms (Middot 2:5) ⚙
          it.stand(0.05, 180);
          it.stand(Math.max(1, tL - tA - 0.2), WOOD.sit.face, { pose: 'sit', prop: 'log', at: [WOOD.sit.at[0], WOOD.sit.at[1], WOOD.sit.at[2] - 1.0 + 1.2], ease: 0.012 });
          it.stand(0.1, 180, { at: [369.4, 372.4, 6], ease: 0.012 });
          it.walkTo([[369.4, 372.4, 6], ...[...inWay].reverse().slice(0, -1), [393, 329, 6]], 1.1);
        } else if (k === 1) {
          it.walkTo([...inWay, WOOD.kneel.at], 1.1);
          it.mark = it.T;
          const at = WOOD.kneel.at;
          let left = tL - tA, m = 0;
          while (left > 0.3 && m < 400) {
            const d = Math.min(left, 2 + 3 * rand(seed, 'wk', m));
            it.stand(d, WOOD.kneel.face, { pose: 'kneel', prop: 'log', at, phase: (q, u) => (u < 0.12 ? (u / 0.12) * 0.5 : u > d - 0.12 ? 0.5 + ((u - d + 0.12) / 0.12) * 0.5 : 0.5), turn: m === 0 });
            left -= d;
            if (left > 0.4 && rand(seed, 'wt', m) < 0.25) {
              // a wormy log: unfit for the altar — thrown aside onto the reject heap
              it.stand(0.25, 220, { pose: 'toss', phase: (q) => q, prop: 'log', at });
              left -= 0.25;
            } else if (left > 0.2) { it.stand(0.15, WOOD.kneel.face, { at }); left -= 0.15; }
            m++;
          }
          it.walkTo([at, ...[...inWay].reverse().slice(0, -1), [393, 329, 6]], 1.1);
        } else {
          // carriers: from the piles to the sorting floor (k 2) and the sorted logs to the east stacks (k 3)
          // (the second takes the sorted logs from the floor's far end, not where the first lays them down)
          const [from, to] = k === 2 ? [WOOD.pile, WOOD.floor] : [WOOD.floor2, WOOD.stack];
          it.walkTo([...inWay, from], 1.1);
          it.mark = it.T;
          let left = tL - tA, m = 0;
          while (left > 0.6 && m < 400) {
            const t0 = it.T;
            it.stand(0.18, 0, { pose: 'kneel', phase: (q) => q, at: from });
            it.walkTo([from, to], 0.9, { pose: 'carry_shoulder_walk', prop: 'log' });
            it.stand(0.18, 0, { pose: 'kneel', phase: (q) => q, prop: 'log', at: to });
            it.walkTo([to, from], 1.0);
            it.stand(0.3 + rand(seed, 'wc', k, m) * 1.5, 0, { at: from });
            left -= it.T - t0; m++;
          }
          it.walkTo([from, ...[...inWay].reverse().slice(0, -1), [393, 329, 6]], 1.1);
        }
      },
    }))]);
  }
  state.troupes.push(new Troupe(state.wood, { plan: (k) => eps[k], legs: (e) => e.it }));
}

// ------------------------------------------------------------------------------------------------ nazirites
/**
 * The day's nazirites: as many as private-offerings counted (its one day quantile — CLAUDE.md), none on many days;
 * without G5, this module's own draw from offerings.js. Each set: the party up from the city over the Mount to Sha'ar
 * HaKorban's flight (the nazir leading the ram, a companion the two lambs, another the basket), the animals in the
 * court (g4/sets.js scriptNazir, at rings and hooks G5 does not use, kept clear of its bookings), the shaving and the
 * cooking in the chamber, the waving in the court (scriptWaving), home by the circuit.
 */
function nazirites(state, P, seed, sim, ctx, book) {
  const [w0, w1] = P.W.naz;
  const G = geoOf(ctx);
  const P5 = g5PlanOf(ctx, sim);
  const f = OFFERING_TYPES.nazir.frequency;
  const n = P5 ? (P5.counts?.nazir ?? 0) : Math.round(f.lo + dayQuantile(ctx) * (f.hi - f.lo));
  P.nNaz = n;
  P.nazSource = P5 ? 'private-offerings' : 'own draw';
  if (!n) return;
  const fires = [];
  const ep = { nazir: [[], [], []], shaven: [[], [], []], comp: Array.from({ length: 6 }, () => []), lamb: [[], [], [], []], ram: [[], []] };
  const span = Math.max(0, w1 - w0 - 175);
  const back = entryBack();
  for (let i = 0; i < Math.min(3, n); i++) {
    const target = w0 + 8 + span * ((i + 0.1 + 0.8 * rand(seed, 'nz', i)) / Math.min(3, n));
    // the court: the earliest placement (of a few ways to lay it out) from the target on
    const pl = placeSet(NAZIR_COMBOS.map((combo) => (F) => scriptNazir(G, i, seed, combo, back, F)), target, book, P5, G, { maxShift: 150, step: 3 });
    if (!pl) continue;
    const B = pl.B, sy = B.sync, tA = B.s;
    if (tA + 140 > w1 + 40) continue;
    bookSet(B, book, P5, pl.hot, WHO, pl.H, pl.own);
    // ---- the party up from the city to the foot of the Korban gate's flight, the animals on their ropes behind
    const gate = bestEntry('korban');
    const arrive3 = (target2, pose, prop, prev) => booked(book, target2, (it) => { arrive(it, { gate, spur: 'korban', cls: 0, pose, prop, prev }); it.mark = it.T; });
    const eO = arrive3(tA, 'lead_walk', null, null);
    const eC1 = arrive3(tA + sy.dtC1, 'lead_walk', null, eO.it.cols);
    const eC2 = arrive3(tA + sy.dtC2, 'carry_shoulder_walk', 'loaves_todah', eC1.it.cols);
    // the animals walk where their leaders walked: keep the lane free behind them too
    for (const [e, lags] of [[eO, [sy.lagR]], [eC1, sy.lagL]]) {
      for (const h of [...(e.it.mp?.taken || [])]) if (h.lane) for (const g of lags) e.it.mp.taken.push(h.lane.shadow(h, g, WHO));
    }
    const k3 = i % 3, kL = (i % 2) * 2, kR = i % 2;
    ep.nazir[k3].push(eO);
    ep.comp[2 * k3].push(eC1);
    ep.comp[2 * k3 + 1].push(eC2);
    const lead = (pool, k) => () => pool.slot(k).actor || null;
    ep.ram[kR].push({ t0: eO.t0, T: eO.T, it: new Follower(eO.it, sy.lagR), leader: lead(state.nazir, k3) });
    ep.lamb[kL].push({ t0: eC1.t0, T: eC1.T, it: new Follower(eC1.it, sy.lagL[0]), leader: lead(state.comp, 2 * k3) });
    ep.lamb[kL + 1].push({ t0: eC1.t0, T: eC1.T, it: new Follower(eC1.it, sy.lagL[1]), leader: lead(state.comp, 2 * k3) });
    // ---- the court (tracks on the same figures)
    const forced = new Map();
    for (const tr of B.tracks) {
      if (tr.role === 'O') forced.set(tr, k3);
      else if (tr.role === 'C1') forced.set(tr, 2 * k3);
      else if (tr.role === 'C2') forced.set(tr, 2 * k3 + 1);
      else if (tr.role === 'AR') forced.set(tr, kR);
      else if (tr.role === 'AC') forced.set(tr, kL);
      else if (tr.role === 'AO') forced.set(tr, kL + 1);
    }
    state.cast.assign(B, forced);
    // ---- the chamber
    const ch = chamber(state, P, seed, sim, ctx, book, G, P5, B, i, k3, ep);
    if (!ch) continue;
    fires.push([...ch.fire, k3]);
    P.naz.push({ t0: tA, set: B, wave: ch.wave });
    P.sets.push(B);
    if (ch.wave) P.sets.push(ch.wave);
  }
  P.naz.sort((a, b) => a.t0 - b.t0);
  P.nazFire = (t, pit) => {
    let v = 0;
    for (const [a, b, k] of fires) if (k === pit && within(t, a - 1, b + 1)) v = Math.max(v, smooth(a - 1, a + 1, t) * (1 - smooth(b - 3, b, t)) * 0.75);
    return v;
  };
  const leadCb = (k, slot, s, e) => { const L = e.leader?.() || null; if (slot._lead !== L) { slot._lead = L; slot.actor?.setLead?.(L); } };
  state.troupes.push(new Troupe(state.nazir, { plan: (k) => ep.nazir[k], legs: (e) => e.it }));
  state.shaven.forEach((pool, k) => state.troupes.push(new Troupe(pool, { plan: () => ep.shaven[k], legs: (e) => e.it })));
  state.troupes.push(new Troupe(state.comp, { plan: (k) => ep.comp[k], legs: (e) => e.it }));
  state.troupes.push(Object.assign(new Troupe(state.setLamb, { plan: (k) => ep.lamb[k], legs: (e) => e.it }), { cb: leadCb }));
  state.troupes.push(Object.assign(new Troupe(state.setRam, { plan: (k) => ep.ram[k], legs: (e) => e.it }), { cb: leadCb }));
}

/**
 * The nazir's party from the foot of the fifteen steps on: the shaving in the chamber (C2 shaves him), the ram's meat
 * into the pot (C1, who lights the fire), the hair with some broth under the pot, the cooked foreleg taken by a kohen
 * and carried up with the nazir to the waving, back down, and home with the meat and the loaves by the circuit.
 * Returns { fire: [t0, t1], wave } (the placed waving set).
 */
function chamber(state, P, seed, sim, ctx, book, G, P5, B, i, k3, ep) {
  const sy = B.sync, tA = B.s;
  const pit = NAZ.pits[k3], bench = NAZ.bench[k3];
  // the pot on its pit (the hearth's value for the cue's place); the places in front of it on the floor: C1 tending it,
  // the nazir at it with his hair, a step back while the kohen takes the foreleg
  const potAt = [pit[0], pit[1], 6];
  const tendC1 = [NAZ.tend, pit[1] - 1.0, 6], atPotN = [NAZ.tend, pit[1] + 0.6, 6], backN = [NAZ.tend - 1.0, pit[1] + 1.7, 6];
  const benchAt = [bench[0], bench[1] + 1.25, 6];
  const sitAt = [bench[0], bench[1] + 0.45, 6.9 - 1.0];
  const basketAt = [bench[0] - 1.1, bench[1] - 0.2, 6.9];
  const r = (k) => rand(seed, 'nzc', i, k);
  // ---- C1 with the meat: to the pot, the meat in, the fire lit
  const c1 = new Itin();
  c1.walkTo([sy.pMeatFoot, ...TO_NAZ.slice(1), [NAZ.tend - 2.0, pit[1] - 1.0, 6], tendC1], 1.0, { pose: 'carry_shoulder_walk', prop: 'lamb_carcass' });
  c1.stand(1.0, 90, { pose: 'pour', prop: 'lamb_carcass' });
  const tPot = tA + sy.tMeatFoot + c1.T;               // the meat in the pot
  c1.stand(1.4, 90, { pose: 'stoke', prop: null });
  const tCooked = tPot + 24 + 6 * r(1);                  // ⚙ the foreleg boiled (compressed)
  // ---- the nazir: to the bench, shaved, the hair to the pot
  const nz = new Itin();
  nz.walkTo([sy.pNazirOut, ...TO_NAZ.slice(1), [benchAt[0], benchAt[1] + 1.2, 6], benchAt], 1.05);
  nz.stand(0.12, 0, {});
  const tSit = tA + sy.tNazirFoot + nz.T;
  const shave = 18 + 8 * r(2);                           // offerings.js giluach: 15–30 min
  nz.stand(shave, 0, { pose: 'sit', at: sitAt, ease: 0.012 });
  nz.done();
  const tShaved = tSit + shave;
  ep.nazir[k3].push({ t0: tA + sy.tNazirFoot, T: nz.T, it: nz });
  // C2: sets the basket down on the bench, shaves him (a razor: 'knife_flay' until people has one — requested)
  const c2 = new Itin();
  c2.walkTo([sy.pC2Foot, ...TO_NAZ.slice(1), [bench[0] - 1.1, bench[1] + 1.6, 6]], 1.0, { pose: 'carry_shoulder_walk', prop: 'loaves_todah' });
  c2.stand(0.3, 180, { pose: 'kneel', phase: (q) => q, prop: 'loaves_todah' });
  const tBasket = tA + sy.tC2Foot + c2.T;
  c2.walkTo([[bench[0] - 1.1, bench[1] + 1.6, 6], [bench[0] + 0.3, bench[1] + 2.4, 6]], 0.8);
  c2.stand(Math.max(0.5, tShaved - (tA + sy.tC2Foot + c2.T)), 180, { pose: 'semichah_high', prop: 'knife_flay' });
  c2.stand(0.3, 180, {});
  // the shaven man: the hair and some broth under the pot once the pot has cooked a while (Nazir 6:8; Rambam Nezirut 8:2)
  const sh = new Itin();
  sh.stand(0.12, 0, { at: sitAt, pose: 'sit' });
  sh.stand(0.15, 0, { at: benchAt, ease: 0.012 });
  const tHair = Math.max(tShaved + 1.2, tPot + 6);
  sh.stand(Math.max(0.1, tHair - (tShaved + sh.T) - 0.6), 0, { pose: 'stand' });
  sh.walkTo([benchAt, [NAZ.tend - 2.2, pit[1] + 0.6, 6], atPotN], 0.9, { pose: 'carry_walk', prop: 'bowl' });
  const tToss0 = tShaved + sh.T;
  sh.stand(0.4, 90, { pose: 'pour', phase: (q) => q, prop: 'bowl' });
  sh.stand(0.3, 90, { pose: 'toss', phase: (q) => q, prop: 'bowl' });
  P.cues.push({ key: `naz-hair:${Math.round(tA)}`, at: tToss0 + 0.55, pos: potAt,
    text: { en: 'The nazir takes some of the broth, puts it on his hair, and casts the hair into the fire under the pot of his peace-offering (Nazir 6:8; Rambam Nezirut 8:2)', he: 'וְנוֹטֵל מִן הָרֹטֶב וְנוֹתֵן עַל הַשֵּׂעָר וּמְשַׁלֵּחַ תַּחַת הַדּוּד' } });
  // ---- the waving: a kohen comes down for the cooked foreleg and a loaf and a wafer, and up with him to the court
  const wPl = placeSet((F) => scriptWaving(G, i, seed, sy, { potAt, basketAt }, F), tCooked, book, P5, G, { maxShift: 40 });
  let tUp = tCooked, tW = NaN, tBack = NaN, wave = null;
  if (wPl) {
    wave = wPl.B;
    bookSet(wave, book, P5, wPl.hot, WHO, wPl.H, wPl.own);
    state.cast.assign(wave, new Map());
    tUp = wave.s + wave.sync.tTake;               // the kohen has the foreleg and the loaves: they go up
    tW = wave.s + wave.sync.tW;
    tBack = tW + wave.sync.dur;
  }
  // the shaven man waits by the pot (a step back while the kohen takes the foreleg), then goes up behind the kohen
  sh.stand(Math.max(0.2, tUp - 0.9 - (tShaved + sh.T)), 80, { pose: 'stand' });
  sh.walkTo([atPotN, backN], 0.6);
  sh.stand(Math.max(0.1, tUp - (tShaved + sh.T)), 80, { pose: 'stand' });
  if (wave) {
    const up = [backN, ...[...TO_NAZ].reverse().slice(1), ...graphPts(G, STEP_FOOT, wave.sync.ownerIn, { to: 'E_M' }).slice(1), wave.sync.owner];
    const upIt = new Itin(); upIt.walkTo(up, 1.0);
    // a pace behind the kohen, arriving as the waving begins
    sh.stand(Math.max(0.05, tW - 0.1 - upIt.T - (tShaved + sh.T)), 80, { pose: 'stand' });
    sh.walkTo(up, 1.0);
    sh.stand(Math.max(0.1, tW - (tShaved + sh.T)), 270, { pose: 'stand' });
    sh.stand(wave.sync.dur, 270, { pose: 'wave', prop: 'limb_foreleg', left: 'chavitin' });
    P.cues.push({ key: `naz-wave:${Math.round(tW)}`, at: tW + 0.3, pos: wave.sync.owner,
      text: { en: 'The kohen puts the cooked foreleg, a loaf and a wafer on the nazir\'s palms with the breast, the thigh and the eimurim, his own hands beneath, and waves them; now the nazir may drink wine (Nazir 6:9; Rambam MK 9:9)', he: 'וְנוֹתֵן עַל כַּפֵּי הַנָּזִיר וּמְנִיפָן' } });
    sh.stand(0.4, 270, { pose: 'bow', phase: (q) => q });
    // back down to his chamber
    const down = [wave.sync.owner, wave.sync.ownerIn, ...graphPts(G, wave.sync.ownerIn, STEP_FOOT, { from: 'E_M' }).slice(1), ...TO_NAZ.slice(1), backN];
    sh.walkTo(down, 1.05);
  }
  const tHome = tShaved + sh.T + 0.6;                  // all three set off with the meat and the loaves
  // ---- home: C1 with the cooked meat, C2 with the basket, the nazir, by the en spur and the circuit
  const home = (it, pose, prop, from, prev) => {
    it.walkTo([from, ...[...TO_NAZ].reverse().slice(1, -1), [393, 329, 6]], 1.0, { pose, prop });
    leave(it, { spur: 'en', cls: 0, pose, prop, prev });
  };
  // C1 tends the pot till they go
  c1.stand(Math.max(0.5, tHome - (tA + sy.tMeatFoot + c1.T)), 90, { pose: 'stand' });
  c1.stand(0.5, 90, { pose: 'kneel', phase: (q) => q, prop: 'wine_jug' });
  c2.walkTo([[bench[0] + 0.3, bench[1] + 2.4, 6], [bench[0] + 1.6, bench[1] + 2.4, 6]], 0.8);
  c2.stand(Math.max(0.3, tHome - 0.2 - (tA + sy.tC2Foot + c2.T)), 180, { pose: 'stand' });
  c2.stand(0.3, 180, { pose: 'kneel', phase: (q) => 1 - q, prop: 'loaves_todah' });
  // the three go out one behind another, booked on the Mount from their clock start
  const goHome = (it, t0It, pose, prop, prev) => {
    it.mp = mpOf(book, t0It, WHO);
    home(it, pose, prop, [it.end.X, it.end.Y, it.end.Z], prev);
    it.done();
  };
  goHome(sh, tShaved, 'walk', null, null);
  goHome(c1, tA + sy.tMeatFoot, 'carry_walk', 'wine_jug', sh.cols);
  goHome(c2, tA + sy.tC2Foot, 'carry_shoulder_walk', 'loaves_todah', c1.cols);
  ep.shaven[k3].push({ t0: tShaved, T: sh.T, it: sh });
  ep.comp[2 * k3].push({ t0: tA + sy.tMeatFoot, T: c1.T, it: c1 });
  ep.comp[2 * k3 + 1].push({ t0: tA + sy.tC2Foot, T: c2.T, it: c2 });
  // the basket on the bench while he is shaved (a free prop)
  P.baskets.push({ k: k3, t0: tBasket + 0.15, t1: tHome - 0.2, at: basketAt });
  return { fire: [tPot - 0.6, tHome + 0.5], wave };
}

/** the basket set down on the bench (one free prop per chamber place) */
function poseBaskets(ctx, state, P, t) {
  for (let k = 0; k < 3; k++) {
    const b = P.baskets.find((x) => x.k === k && t >= x.t0 && t < x.t1);
    let f = state.baskets[k];
    if (b && f === undefined) {
      let a = null;
      try { a = ctx.people?.spawnProp?.('loaves_todah', { seed: SEED + k }) || null; a?.setVisible?.(false); } catch { a = null; }
      f = state.baskets[k] = a ? { a, on: false, key: '' } : null;
    }
    if (!f) continue;
    if (b) {
      const key = b.at.join(',');
      if (f.key !== key) { f.key = key; f.a.setSite(b.at[0], b.at[1], b.at[2]); f.a.setHeading(0); }
      if (!f.on) { f.on = true; f.a.setVisible(true); }
    } else if (f.on) { f.on = false; f.a.setVisible(false); }
  }
}

// ------------------------------------------------------------------------------------------------ the Golah wheel
function golah(state, P, seed, sim, book) {
  const [w0, w1] = P.W.golah;
  // one draw every CYCLE minutes: the bucket raised (the drum winds its rope — ≈ 3.8 turns for the 13 amot from the
  // water to the curb), emptied, lowered again ⚙
  const CYCLE = 6, RAISE = [0.3, 2.6], LOWER = [3.7, 4.8];
  const TURNS = 3.8 * 2 * Math.PI;
  const t0 = w0 + 3, t1 = w1 - 3;
  const nCyc = Math.max(0, Math.floor((t1 - t0) / CYCLE));
  P.wheelAngle = (t) => {
    if (!within(t, t0, t0 + nCyc * CYCLE)) return 0;
    const u = since(t, t0) % CYCLE;
    if (u < RAISE[0]) return 0;
    if (u < RAISE[1]) return TURNS * smooth(RAISE[0], RAISE[1], u);
    if (u < LOWER[0]) return TURNS;
    if (u < LOWER[1]) return TURNS * (1 - smooth(LOWER[0], LOWER[1], u));
    return 0;
  };
  for (let c = 0; c < nCyc; c++) P.cues.push({ key: `golah:${Math.round((t0 + c * CYCLE) * 10)}`, at: t0 + c * CYCLE + RAISE[0] + 0.05, pos: [93, 386, 18], sound: 'muchni', range: 22 });
  // the two Levites: in by Sha'ar HaNitzotz from the north side of the Mount (report §61 ⚙ who turned it)
  const eps = [0, 1].map((k) => [booked(book, w0 + 0.3 * k, (it) => visit(it, {
    gate: 'ce', spur: 'nitzotz', v: 1.2,
    build: (it) => {
      const S = k === 0 ? GOLAH.wheel : GOLAH.curb;
      it.walkTo([[114.5, 396, 16], [104, 382, 16], ...GOLAH.door, S.at], 1.05);
      it.mark = it.T;
      // until the first cycle, at the post; then every cycle laid against its own start (no drift)
      it.stand(Math.max(0.2, t0 - (w0 + 0.3 * k)), S.face, { pose: 'stand' });
      const cyc0 = it.T;
      const at = (c, x) => cyc0 + c * CYCLE + x;      // minutes into the itinerary of cycle c's moment x
      for (let c = 0; c < nCyc; c++) {
        if (k === 0) {
          it.stand(at(c, RAISE[0] + 0.05) - it.T, S.face, { pose: 'stand' });
          it.stand(at(c, RAISE[1]) - it.T, S.face, { pose: 'sweep' });           // hand over hand on the spokes ('crank' requested)
          it.stand(at(c, LOWER[0]) - it.T, S.face, { pose: 'stand' });
          it.stand(at(c, LOWER[1]) - it.T, S.face, { pose: 'raise_hands_low' }); // letting it run back, braking
          it.stand(at(c + 1, 0) - it.T, S.face, { pose: 'stand' });
        } else {
          it.stand(at(c, RAISE[1]) - it.T, S.face, { pose: 'stand' });
          it.stand(0.35, S.face, { pose: 'carry', prop: 'bowl' });                // the bucket at the curb
          it.stand(0.55, S.face, { pose: 'pour', prop: 'wine_jug' });             // into the jar ⚙ prop
          // out of the door with the jar to the court and back (the water for the court's needs) ⚙
          it.walkTo([S.at, [93.0, 379.6, 16], GOLAH.outside], 0.9, { pose: 'carry_walk', prop: 'wine_jug' });
          it.stand(0.2, 140, { pose: 'kneel', phase: (q) => q, prop: 'wine_jug' });
          it.walkTo([GOLAH.outside, [93.0, 379.6, 16], S.at], 1.0);
          it.stand(Math.max(0.05, at(c + 1, 0) - it.T), S.face, { pose: 'stand' });
        }
      }
      it.stand(Math.max(0.2, w1 - (t0 + nCyc * CYCLE)), S.face, { pose: 'stand' });
      it.walkTo([S.at, ...[...GOLAH.door].reverse(), [104, 382, 16], [110, 396, 16]], 1.05);
    },
  }))]);
  state.troupes.push(new Troupe(state.golah, { plan: (k) => eps[k], legs: (e) => e.it }));
}

// ------------------------------------------------------------------------------------------------ the Parvah
// The salters are kohanim in the holy garments: they come out of Beit HaMoked (where the kohanim on duty come and go —
// private-offerings' MOK_X) across the court on its walking graph to the Parvah, never over the Mount ⚙
function parvah(state, P, seed, sim, ctx) {
  const [w0, w1] = P.W.parvah;
  const G = geoOf(ctx);
  const inWay = graphPts(G, 'MOK_X', 'S_PAR', {});
  const outWay = graphPts(G, 'S_PAR', 'MOK_X', {});
  const planFn = (k) => {
    const it = new Itin();
    if (k < 2) {
      const S = PARVAH.salters[k];
      it.walkTo([...inWay, ...PARVAH.door.slice(1), S.at], 1.15);
      it.mark = it.T;
      workAt(it, w1 - w0 - 0.4 * k, S.at, S.face, [['salt', 'salt', 4], ['stand', 'salt', 1], ['raise_hands_low', null, 1]], seed, `pv${k}`);
      it.walkTo([S.at, ...[...PARVAH.door].reverse(), ...outWay.slice(1)], 1.15);
    } else {
      // to and fro: salt from Lishkat HaMelach next door; a fresh hide thrown over a rack ⚙
      it.walkTo([...inWay, ...PARVAH.door.slice(1), PARVAH.rack.at], 1.15);
      it.mark = it.T;
      let left = w1 - w0 - 1, n = 0;
      while (left > 4 && n < 200) {
        const t0 = it.T;
        it.walkTo([PARVAH.rack.at, ...[...PARVAH.door].reverse(), ...PARVAH.melach], 1.0);
        it.stand(0.4, 180, { pose: 'kneel', phase: (q) => q });
        it.walkTo([...[...PARVAH.melach].reverse(), ...PARVAH.door, PARVAH.rack.at], 0.9, { pose: 'carry_walk', prop: 'salt' });
        it.stand(0.5, 180, { pose: 'salt', prop: 'salt' });
        it.stand(0.3, 180, { pose: 'raise_hands', prop: 'hide' });
        it.stand(1.5 + 4 * rand(seed, 'pr', n), 180, { pose: 'salt', prop: 'salt' });
        left -= it.T - t0; n++;
      }
      if (left > 0.2) it.stand(left, 180, { pose: 'stand' });
      it.walkTo([PARVAH.rack.at, ...[...PARVAH.door].reverse(), ...outWay.slice(1)], 1.15);
    }
    it.done();
    return [{ t0: w0 + 0.4 * k - it.mark, T: it.T, it }];
  };
  state.troupes.push(new Troupe(state.parvah, { plan: planFn, legs: (e) => e.it }));
}

// ------------------------------------------------------------------------------------------------ Beit Garmu
function garmu(state, P, seed, sim) {
  const [w0, w1] = P.W.garmu;
  // the twelve loaves, kneaded one by one and baked two by two (Menachot 11:1): kneaded and shaped in the hall's chol
  // half, baked in the showbread chamber's oven. Kohanim in the holy garments: they come out of Pinchas' chamber and
  // through the court and the Moked gate into the hall, never over the Mount ⚙
  const posts = [GARMU.oven, GARMU.kneaders[0], GARMU.kneaders[1], GARMU.shaper];
  const planFn = (k) => {
    const S = posts[k];
    const it = new Itin();
    const via = k === 0 ? [[214.0, 400.0, 16], GARMU.door, [217.0, 396.2, 16]] : k === 3 ? [[214.6, 402.6, 16]] : [[212.2, 402.8, 16]];
    it.walkTo([...TO_MOKED, ...via, S.at], 1.15);
    it.mark = it.T;
    const min = w1 - w0 - 0.5 * k;
    if (k === 0) workAt(it, min, S.at, S.face, [['stoke', null, 2], ['pour', null, 1], ['stand', null, 1]], seed, 'ov');
    else if (k < 3) {
      it.stand(0.25, S.face, { pose: 'kneel', phase: (q) => q * 0.5 });
      it.stand(Math.max(0.5, min - 0.5), S.face, { pose: 'kneel', phase: 0.5, prop: 'bowl' });
      it.stand(0.25, S.face, { pose: 'kneel', phase: (q) => 0.5 + q * 0.5 });
    } else {
      // the shaper (north of the kodesh line: shaping is outside, Menachot 11:2) takes each dough from the kneaders into
      // the mould and to the oven's door ⚙
      let left = min, n = 0;
      while (left > 1.5 && n < 300) {
        const t0 = it.T;
        const kn = GARMU.kneaders[n % 2].at;
        it.walkTo([S.at, [kn[0] + (n % 2 ? -0.9 : 0.9), kn[1] - 0.6, 16]], 0.9);
        it.stand(0.4, n % 2 ? 80 : 280, { pose: 'carry', prop: 'bowl' });
        it.walkTo([[kn[0] + (n % 2 ? -0.9 : 0.9), kn[1] - 0.6, 16], S.at], 0.85, { pose: 'carry_walk', prop: 'bowl' });
        it.stand(0.5, S.face, { pose: 'kemitzah', prop: 'bowl' });
        it.walkTo([S.at, [217.4, 400.4, 16]], 0.8, { pose: 'carry_walk', prop: 'bowl' });
        it.stand(0.3, 180, { pose: 'carry', prop: 'bowl' });
        it.walkTo([[217.4, 400.4, 16], S.at], 0.85);
        it.stand(1.0 + 2.2 * rand(seed, 'sh', n), S.face, { pose: 'stand' });
        left -= it.T - t0; n++;
      }
      if (left > 0.1) it.stand(left, S.face);
    }
    it.walkTo([S.at, ...[...via].reverse(), ...[...TO_MOKED].reverse()], 1.15);
    it.done();
    return [{ t0: w0 + 0.4 * k - it.mark, T: it.T, it }];
  };
  state.troupes.push(new Troupe(state.garmu, { plan: planFn, legs: (e) => e.it }));
}

/** minutes into an itinerary (from `from`) at which it crosses Y 413 (the door to the chel) */
function doorCross(it, from) {
  const s = {};
  let prev = null;
  for (let u = from; u <= it.T; u += 0.01) { it.sample(u, s); if (prev != null && (prev - 413) * (s.Y - 413) <= 0) return u - from; prev = s.Y; }
  return 0;
}

// ------------------------------------------------------------------------------------------------ the seals
function seals(state, P, seed, sim, book) {
  const [w0, w1] = P.W.seals;
  const eps = [0, 1].map((k) => {
    const S = k === 0 ? SEALS.achiyah : SEALS.yochanan;
    let passIn = 0, passOut = 0;
    const e = booked(book, w0 + 0.5 + 0.3 * k, (it) => visit(it, {
      gate: 'ce', spur: 'moked', v: 1.15,
      build: (it) => {
        passIn = it.T - 0.05;
        it.walkTo([[214.5, 409, 16], [S.at[0], S.at[1] + 1.4, 16], S.at], 1.0);
        it.mark = it.T;
        const min = w1 - w0 - 1.2 - 0.3 * k;
        if (k === 0) {
          // Achiyah brings out the seals from the chamber (Tamid 3:3 — the chamber of seals) ⚙
          it.stand(0.4, S.face);
          it.walkTo([S.at, SEALS.door, SEALS.inside], 0.8);
          it.stand(0.7, 20, { pose: 'stand' });
          it.walkTo([SEALS.inside, SEALS.door, S.at], 0.8, { prop: 'bowl', pose: 'carry_walk' });
          workAt(it, Math.max(1, min - 2.6), S.at, S.face, [['carry', 'bowl', 3], ['point', 'bowl', 1], ['stand', 'bowl', 1]], seed, 'ac');
        } else {
          // Yochanan counts out coin for each seal; a surplus to the Temple, a shortfall from his own (Shekalim 5:4)
          workAt(it, min, S.at, S.face, [['kemitzah', 'bowl', 3], ['carry', 'bowl', 2], ['stand', null, 1]], seed, 'yo');
        }
        passOut = it.T;
        it.walkTo([S.at, [S.at[0] - 1.2, S.at[1] + 2.2, 16], [207.5, 409, 16]], 1.0);
      },
    }));
    P.chelPass.push(e.t0 + passIn, e.t0 + passOut + doorCross(e.it, passOut));
    return [e];
  });
  state.troupes.push(new Troupe(state.seals, { plan: (k) => eps[k], legs: (e) => e.it }));
  P.cues.push({ key: `seals:${Math.round(w0)}`, at: w0 + 4, pos: SEALS.door,
    text: { en: 'In the evening Achiyah brings out the day\'s seals and receives coin to match from Yochanan ben Pinchas; a surplus goes to the Temple, a shortfall Yochanan pays from his own house (Shekalim 5:4)', he: 'וְלָעֶרֶב בָּאִין זֶה אֵצֶל זֶה' } });
}

// ------------------------------------------------------------------------------------------------ cues
function cues(ctx, state, sim, t, P) {
  for (const c of P.cues) {
    if (!crossed(state, c.at)) continue;
    sim.cueAt(c.key, c.at, () => {
      if (!observerNear(ctx, c.pos, c.range ?? CAPTION_RANGE)) return;
      if (c.sound) sim.sound(c.sound, c.pos, { gain: 0.7 });
      if (c.text) sim.caption(c.text, { id: 'chambers', duration: 7 });
    });
  }
  // the sets' own cues: the leanings' words, the bleat at the binding, the libation
  for (const B of P.sets) for (const c of B.cues) {
    if (!crossed(state, c.t)) continue;
    sim.cueAt(`set:${B.role}:${c.key || c.id}:${Math.round(c.t * 10)}`, c.t, () => {
      if (!observerNear(ctx, c.pos, c.kind === 'sound' ? 60 : (c.range || 30))) return;
      if (c.kind === 'sound') sim.sound(c.id, c.pos, c.opts);
      else sim.caption(c.text, { id: 'chambers', duration: 6 });
    });
  }
}

export { norm, release, SPURS, CAPTION_RANGE };

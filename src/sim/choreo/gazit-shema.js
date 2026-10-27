// The Shema in Lishkat HaGazit (Tamid 4:3–5:1; Berachot 11b–12a; Sukkah 56b; Yoma 25a; report §27.3).
//
// Events served (choreo 'gazit-shema'):
//   gazit-shema        after laying the parts on the ramp they go down to Lishkat HaGazit to read the Shema (Tamid 4:3).
//                      The officer: "Recite one blessing"; they read the Ten Commandments, Shema, Vehayah im shamoa and
//                      Vayomer, and bless the people with three blessings — Emet veyatziv, Avodah and the priestly
//                      blessing (Tamid 5:1). Staged in the chamber's east, its holy half, where the lotteries are held
//                      (Yoma 25a), the kohanim standing in rows facing the Heichal ⚙, the officer before them.
//   outgoing-blessing  on Shabbat one blessing more, for the outgoing watch (Tamid 5:1): "May He who caused His Name to
//                      dwell in this House cause love and brotherhood, peace and friendship to dwell among you"
//                      (Berachot 12a) — the outgoing mishmar in the south rows ⚙ turns to the incoming in the north (the
//                      showbread is divided so — Sukkah 56b).
// Who: the Gazit's regulars and the officer (lotteries.js's 'gazit' and 'officer' seeds: they come from the chavitin
// makers' chamber as in lotteries.js, and at the end walk into that module's circle for the third and fourth lotteries,
// where it takes them over); the nine of the tamid with its slaughterer, taken over at the door the moment tamid-morning
// brings each there (its crew seed; `lead` covers the earliest); on Shabbat the incoming watch (SEEDS.shabbatIn: the
// afternoon tamid's crew and fetchers, G6's incoming men) in by the Nikanor gate. No one sits in the Azarah (Rambam BhB
// 7:6): they stand. The recitation is shown as speech in turn, never in unison ⚙ — most stand, a few speak at a time;
// the words are captions, once each in continuous play. The hall's floor is flat: every figure stands at Z 16 exactly
// (no floor query, which picked the roof and upper beams near the door). Every pose is a pure function of (t, date).
import { Script, runScripts, playerNear, win, SPEED, jit, wrap, walkMin, headingOf } from './g2/lib.js';
import { places } from './g2/places.js';
import { buildTamid, tamidWindows, cfgFor, CREW, CREW_N, SEEDS, N_IN, GAZIT_SEED } from './g2/tamid.js';
import { cueAt, crossed, CUE_LEAD } from '../lib/cue.js';
import { rand } from '../lib/core.js';
import { lotRadius } from './g1/places.js';
import { gazitShema as inspectHooks } from './describe/sanctuary.js';

const SEED = 0x6773;
const G1 = { gazit: GAZIT_SEED, officer: 0x6743 };   // lotteries.js (g1/plan.js SEED): the same men, the same faces
const NREG = 20;             // the Gazit's regulars = the third lottery's circle (lotteries.js N = 20)
const CREW_IN = [CREW.S, ...CREW.L, CREW.F, CREW.C, CREW.WN];   // from the ramp (the receiver took the hide to the Parvah)
const NEAR = 30;             // m — inside the chamber or at its door

export default {
  id: 'gazit-shema',
  // inspect hooks (console-design §6.2): who each figure is and what it is doing; no behaviour change
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  lead: 9,           // tamid-morning brings the slaughterer to the door ≈ 5–6 min before the Shema (g2/tamid.js gazitIn)
  lag: 0.8,
  importance: 2,

  init(ctx, events, sim) {
    const P = places(ctx);
    sim.setBounds([43, 300, 13], [260, 391, 36]);
    const state = {
      P,
      men: sim.pool({ name: 'kohanim', role: 'kohen', count: NREG, seed: G1.gazit, importance: 2 }),
      incoming: sim.pool({ name: 'incoming', role: 'kohen', count: N_IN, seed: SEEDS.shabbatIn, importance: 2 }),
      crew: sim.pool({ name: 'tamid-crew', role: 'kohen', count: CREW_N, seed: SEEDS.morning, importance: 2 }),
      officer: sim.pool({ name: 'officer', role: 'kohen', count: 1, seed: G1.officer, importance: 2 }),
      plan: null, planGen: -1, out: {}, fns: [], fnsI: [], fnsC: [], fnsO: [],
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    // the per-date plan now, behind the loader (it is rebuilt on a new date)
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    runScripts(ctx, state.men, P.men, t, state.out, state.fns);
    if (P.incoming.length) runScripts(ctx, state.incoming, P.incoming, t, state.out, state.fnsI);
    runScripts(ctx, state.crew, P.crew, t, state.out, state.fnsC);
    runScripts(ctx, state.officer, [P.officer], t, state.out, state.fnsO);
    for (const [key, tc, text, dur] of P.lines) {
      if (!crossed(state, tc)) continue;
      cueAt(state, key, tc, () => { if (playerNear(ctx, P.at, NEAR)) sim.caption(text, { id: key.split(':')[0], duration: dur }); });
    }
  },

  debug(s) {
    const P = s.plan, f = s.fmt;
    return P ? `${P.shabbat ? `Shabbat, both watches (+${P.incoming.length}) · ` : ''}${P.men.filter(Boolean).length} + crew ${P.crew.filter(Boolean).length} + officer · ${f(P.w[0])}–${f(P.w[1])} · to the circle ${f(P.tSwap)}` : 'no plan';
  },
};

function plan(ctx, sim, state) {
  if (state.plan !== undefined && state.planGen === sim.generation) return state.plan;
  state.planGen = sim.generation;
  const P = state.P, Z = P.Z;
  const w = win(sim, 'gazit-shema');
  if (!w) { state.plan = null; return null; }
  const ob = win(sim, 'outgoing-blessing');
  const shabbat = !!ob;
  const kd = P.gazit.kodesh;
  const near = (x) => w[0] + ((x - w[0] + 2160) % 1440) - 720;      // unwrapped near the event
  const t0 = w[0], t1 = near(w[1]);
  const tOb = ob ? near(ob[0]) : NaN;
  // the lotteries' circle (lotteries.js gazitScenes: N 20 round the station, g1/places.js lotRadius; it takes them over
  // at S − 0.3)
  const lot = win(sim, 'third-fourth-lottery');
  const S = lot ? near(lot[0]) : t1;
  const tSwap = S - 0.3;
  const gz = ctx.elOpt?.('azarah.chamber.gazit')?.params;
  const c = gz?.stations?.lottery || P.gazit.lottery;
  const r = lotRadius(NREG);
  const circle = (k) => { const a = (k / NREG) * 360 + 90, ar = a / 57.2958; return { at: [c[0] + Math.sin(ar) * r, c[1] + Math.cos(ar) * r, Z], h: (a + 180) % 360 }; };
  // the hall (courts/chambers.js): a basilica nave between two rows of columns (Y 375.6 and 386.4; X 69.5, 76, 82.5)
  // with lamp stands by them. The rows: in the nave, facing south toward the Heichal ⚙; Shabbat: the incoming in the
  // northern rows (Sukkah 56b: the incoming on the north). The officer before them between two columns.
  const gb = ctx.elOpt?.('azarah.chamber.gazit')?.box || { min: [43, 371, 16], max: [88, 391, 36] };
  const colS = gb.min[1] + 4.6, colN = gb.max[1] - 4.6;
  // (the columns stand on square plinths ≈ 1.3 amot from their axes: the rows keep 1.5 clear of both column lines;
  // eight abreast, six rows: the morning's 30 in rows 0–3, on Shabbat the incoming in rows 4–5, the north)
  const cols = 8, x0 = kd.max[0] - 4.7, dx = 1.85, y0 = colS + 1.55, dy = 1.55;
  const spot = (k) => [x0 - (k % cols) * dx + jit(SEED, 0.2, 'x', k), y0 + Math.floor(k / cols) * dy + jit(SEED, 0.04, 'y', k), Z];
  const spotIn = (j) => spot(32 + j);
  const enter = P.gazit.inside, door = P.gazit.door;
  // in by the east door and round the lamp stand at the south-east column, clear of the column at X 82.5 ⚙
  const hall = [kd.max[0] - 2.4, colS + 3.4, Z];
  const officerAt = [(kd.max[0] - 5.5 + kd.max[0] - 12) / 2, colS + 0.3, Z];
  // speech in turn: most stand listening, a man speaks now and then for a short while (about one in seven at a time) ⚙
  const recite = (s, i, until, outgoing) => {
    const tEnd = Number.isFinite(tOb) && outgoing ? tOb : until;
    let k = 0;
    while (s.now() < tEnd - 0.05) {
      const len = 0.45 + 0.6 * rand(SEED, 'len', i * 31 + k);
      const tk = Math.min(tEnd, s.now() + len);
      const speak = rand(SEED, 'p', i * 31 + k) < 0.15;
      s.until(tk, { pose: speak ? 'sing' : 'stand', heading: 180 + jit(SEED, 8, 'h', i * 31 + k), sway: speak ? 2 : 4, seed: SEED + i * 13 + k });
      k++;
    }
    // the outgoing turn to the incoming and bless them (Berachot 12a)
    if (outgoing) s.until(until, { pose: 'stand', heading: jit(SEED, 10, 'o', i), sway: 3, seed: SEED + i * 7 });
  };
  const toCircle = (s, k) => {
    const cs = circle(k);
    const go = tSwap - 0.12 - walkMin(s.cur, [cs.at], SPEED.slow) - 0.02;
    s.until(Math.max(s.now(), go), { pose: 'stand', heading: 180, sway: 4, seed: SEED + k });
    s.walkBy(tSwap - 0.12, [cs.at]);
    s.act(0.12, { pose: 'stand', heading: cs.h });
  };
  const outDoor = (s, k, tGo) => {
    s.until(Math.max(s.now(), tGo), { pose: 'stand', heading: 90, sway: 6, seed: SEED + 300 + k });
    s.walk([[hall[0], hall[1] + jit(SEED, 0.4, 'od', k), Z], enter, door], { speed: SPEED.slow });
  };
  // from a chamber's door in the court to the Gazit's: the duchan's steps (the first legs) query the floor ⚙
  const comeIn = (s, firstLegs, rest, inPts) => {
    s.walk(firstLegs, { speed: SPEED.walk, zExact: false });
    s.walk([...rest, enter, ...inPts], { speed: SPEED.walk });
  };
  const fc = P.way.fromChavitin;

  // ---- the regulars: out of the chavitin makers' chamber (as lotteries.js) in ones and twos ⚙, by the court's north to
  // the east door, into the rows; at the end into the lotteries' circle
  const men = [];
  for (let i = 0; i < NREG; i++) {
    const sp = spot(i);
    const inPts = [[hall[0] + jit(SEED, 0.3, 'e', i), hall[1] + jit(SEED, 0.5, 'f', i), Z], sp];
    const tArrive = t0 - 0.9 + 1.0 * rand(SEED, 'in', i);
    const tStart = tArrive - walkMin(fc[0], [...fc.slice(1), enter, ...inPts], SPEED.walk);
    const s = Script.from(tStart, fc[0], 270, `k${i}`).exact();
    comeIn(s, fc.slice(1, 3), fc.slice(3), inPts);
    recite(s, i, tSwap - 0.6, shabbat);
    toCircle(s, i);
    men.push(s);
  }
  // ---- Shabbat: the incoming watch, in by the Nikanor gate, to the north rows; out by the door after the blessing ⚙
  const incoming = [];
  if (shabbat) {
    const fn = P.way.fromNikanor;
    for (let j = 0; j < N_IN; j++) {
      const k = 40 + j;
      const sp = spotIn(j);
      const inPts = [[hall[0] + 1.0, hall[1] + 1.2 + jit(SEED, 0.5, 'eS', j), Z], [hall[0] + 0.8, colN - 2.4, Z], sp];
      const legs = [...fn.slice(1), fc[2]];
      const tArrive = t0 - 0.8 + 0.9 * rand(SEED, 'inS', j);
      const tStart = tArrive - walkMin(fn[0], [...legs, ...fc.slice(3), enter, ...inPts], SPEED.walk);
      const s = Script.from(tStart, fn[0], 270, `in${j}`).exact();
      comeIn(s, legs, fc.slice(3), inPts);
      recite(s, k, tSwap, false);
      outDoor(s, k, t1 + 0.05 + 0.08 * j);
      incoming.push(s);
    }
  }
  // ---- the tamid's nine and its slaughterer, from the ramp: tamid-morning brings them to the door (same seeds) and
  // drops each there the moment this module takes him (Script start = his arrival at the inside spot)
  const crew = Array.from({ length: CREW_N }, () => null);
  // tamid-morning's plan for this date (sim.planOf: built now if need be); without that module the same builder here
  let gazitIn = null;
  const tm = sim.planOf?.('tamid-morning');
  if (tm?.M) gazitIn = tm.M.t.gazitIn;
  else {
    try { gazitIn = buildTamid(ctx, P, cfgFor('morning', ctx, P, tamidWindows(ctx, sim))).t.gazitIn; } catch (e) { console.warn('[gazit-shema] tamid plan failed', e); }
  }
  let firstIn = t0;
  CREW_IN.forEach((slot, n) => {
    const tg = gazitIn?.[slot];
    const tIn = Number.isFinite(tg) ? near(tg) : t0 - 0.4 + 0.08 * n;
    firstIn = Math.min(firstIn, tIn);
    const sp = spot(NREG + n);
    const s = Script.from(tIn, enter, 270, `crew${slot}`).exact();
    s.walk([[hall[0] + jit(SEED, 0.3, 'c', n), hall[1] + jit(SEED, 0.5, 'd', n), Z], sp], { speed: SPEED.walk });
    recite(s, NREG + n, t1, shabbat);
    outDoor(s, NREG + n, t1 + 0.1 + 0.07 * n);
    crew[slot] = s;
  });
  if (t0 - firstIn > 9 - 0.1) console.warn(`[gazit-shema] lead 9 does not cover the tamid crew's arrival (${(t0 - firstIn).toFixed(2)} min before)`);

  // ---- the officer: with the regulars, before them; at the end to the middle of the lotteries' circle
  const oIn = [hall, officerAt];
  const oArrive = t0 - 0.35;
  const o = Script.from(oArrive - walkMin(fc[0], [...fc.slice(1), enter, ...oIn], SPEED.walk), fc[0], 270, 'officer').exact();
  comeIn(o, fc.slice(1, 3), fc.slice(3), oIn);
  o.until(t0 + CUE_LEAD + 0.4, { pose: 'point', heading: 0 });
  o.until(tSwap - 0.5, { pose: 'stand', heading: 0, sway: 10, seed: SEED + 99 });
  o.walkBy(tSwap - 0.1, [[c[0], c[1], Z]]);
  o.act(0.1, { pose: 'stand', heading: 90 });

  const at = [(kd.min[0] + kd.max[0]) / 2, (kd.min[1] + kd.max[1]) / 2, Z];
  const lines = [
    [`officer:${Math.round(t0)}`, wrap(t0 + CUE_LEAD), { en: 'The officer: "Recite one blessing!" — and they recite it (Tamid 5:1)', he: 'בָּרְכוּ בְרָכָה אֶחָת' }, 5],
    [`dibrot:${Math.round(t0)}`, wrap(t0 + 1.3), { en: 'They read the Ten Commandments, then Shema, Vehayah im shamoa and Vayomer (Tamid 5:1)', he: 'קָרְאוּ עֲשֶׂרֶת הַדְּבָרִים, שְׁמַע, וְהָיָה אִם שָׁמֹעַ, וַיֹּאמֶר' }, 7],
    [`shema:${Math.round(t0)}`, wrap(t0 + 0.42 * (t1 - t0)), { en: '"Hear, O Israel: the Lord is our God, the Lord is one" (Devarim 6:4)', he: 'שְׁמַע יִשְׂרָאֵל ה׳ אֱלֹהֵינוּ ה׳ אֶחָד' }, 6],
    [`blessings:${Math.round(t0)}`, wrap(t0 + 0.72 * (t1 - t0)), { en: 'They bless the people with three blessings: Emet veyatziv, Avodah, and the priestly blessing (Tamid 5:1)', he: 'אֱמֶת וְיַצִּיב, וַעֲבוֹדָה, וּבִרְכַּת כֹּהֲנִים' }, 7],
  ];
  if (shabbat) {
    lines.push([`outgoing:${Math.round(tOb)}`, wrap(tOb + CUE_LEAD), { en: 'The outgoing watch to the incoming: "May He who caused His Name to dwell in this House cause love and brotherhood, peace and friendship to dwell among you" (Tamid 5:1; Berachot 12a)', he: 'מִי שֶׁשִּׁכֵּן אֶת שְׁמוֹ בַּבַּיִת הַזֶּה הוּא יַשְׁכִּין בֵּינֵיכֶם אַהֲבָה וְאַחֲוָה וְשָׁלוֹם וְרֵעוּת' }, 9]);
  }
  const warn = [...men, ...incoming, ...crew, o].flatMap((x) => x?.warn || []);
  if (warn.length) console.warn('[gazit-shema] plan', warn.slice(0, 3));
  state.plan = { men, incoming, crew, officer: o, w: [w[0], w[1]], shabbat, at, lines, tSwap: wrap(tSwap), headingOf };
  return state.plan;
}

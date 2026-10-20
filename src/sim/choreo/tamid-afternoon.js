// The afternoon tamid (Pesachim 5:1; Tamid 4:1–3; Yoma 2:5, 26a, 33a; Sukkah 56b; Middot 4:7; report §27.3, §28 #11).
//
// Events served (choreo 'tamid-afternoon'):
//   tamid-afternoon    at eight and a half hours the second lamb is slaughtered at the north-east corner, on the second
//                      ring (Tamid 4:1; Pesachim 5:1), and its blood thrown as in the morning. Before it, unscheduled: the
//                      knives from Beit HaChalifot, the lamb brought from the lamb chamber and watered from the gold cup
//                      (as the morning, no torches ⚙).
//   afternoon-flaying  hung, flayed and cut in the morning's order; the nine carry the parts to the lower west half of the
//                      ramp and salt them (Tamid 4:2–3); they wait by the ramp's foot through the incense and the lamps ⚙.
//   afternoon-limbs    at nine and a half hours eleven go up: the nine with the lamb, its flour and chavitin, and two with
//                      the two logs (Yoma 2:5) — limbs, logs, minchah, chavitin (Yoma 33a ⚙ for the logs' place).
// Crew: on weekdays the morning's winners keep their tasks (R' Yochanan, Yoma 26a) — the same faces as tamid-morning;
// on Shabbat the incoming mishmar offers it (Sukkah 56b) — its own faces (SEEDS.shabbatIn: the same men as gazit-shema's
// incoming rows and G6's incoming watch), its two lamb-fetchers too. The lamb waits in the chamber under tamid-morning
// (same slot and seed) until it is led out here. When all is done two kohanim take the vessels back to Lishkat HaKelim ⚙;
// the limbs stay on the fire under tamid-morning (always relevant). Every pose is a pure function of (t, date).
import { runScripts, FreeProps, setLead, playerNear, phaseFn, evalScript, within, wrap } from './g2/lib.js';
import { places } from './g2/places.js';
import { planAfternoon, tamidWindows, buildReturn, CREW, CREW_N, SEEDS, N_IN } from './g2/tamid.js';
import { cueAt, crossed } from '../lib/cue.js';

const NEAR = 45;

export default {
  id: 'tamid-afternoon',
  lead: 21,          // the knives and the lamb are fetched ~20 minutes before the slaughter
  lag: 13,           // the vessels taken back after the limbs, a pair a trip
  importance: 3,

  init(ctx, events, sim) {
    const P = places(ctx);
    sim.setBounds([80, 265, 0], [256, 405, 30]);
    const state = {
      P,
      // weekday crew = the morning's (same seed as tamid-morning's crew) and its fetchers; Shabbat: the incoming
      // mishmar, crew 0–12 and fetchers 13–14
      crewW: sim.pool({ name: 'crew', role: 'kohen', count: CREW_N, seed: SEEDS.afternoon, importance: 3 }),
      fetchW: sim.pool({ name: 'fetchers', role: 'kohen', count: 2, seed: SEEDS.morning + 50, importance: 2 }),
      crewS: sim.pool({ name: 'crew-incoming', role: 'kohen', count: N_IN, seed: SEEDS.shabbatIn, importance: 3 }),
      lamb: sim.pool({ name: 'lambs', animal: 'lamb', count: 2, seed: SEEDS.lambs, importance: 1 }),
      props: new FreeProps(ctx),
      plan: null, planGen: -1, out: {}, fns: { crewW: [], fetchW: [], crewS: [], lamb: [] },
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    // the per-date plan now, behind the loader (it is rebuilt on a new date)
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    const S = state, out = S.out;
    if (P.shabbat) runScripts(ctx, S.crewS, P.crewAll, t, out, S.fns.crewS);
    else {
      runScripts(ctx, S.crewW, P.A.crew, t, out, S.fns.crewW);
      runScripts(ctx, S.fetchW, P.fetchAll, t, out, S.fns.fetchW);
    }
    // the lamb: slot 1 of the lambs (the stand-in tamid-morning keeps in the chamber until now)
    const sl = S.lamb.slot(1);
    if (!S.fns.lamb[0]) S.fns.lamb[0] = phaseFn(ctx, sl);
    evalScript(P.A.lamb, t, out, S.fns.lamb[0]);
    if (out.vis) {
      if (out.zx) sl.place(out.X, out.Y, out.Z); else sl.placeNear(out.X, out.Y, out.Z);
      sl.heading(out.h).pose(out.pose, out.ph).show();
    }
    let lead = null;
    for (const [a, b, who] of P.leads) if (within(t, a, b)) lead = who === 'fetch' ? P.fetcher(S) : P.slaughterer(S);
    setLead(sl, lead);
    S.props.update(t);
    cues(ctx, S, P, sim);
  },

  release(ctx, state) { state.props.hideAll(); },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan';
    const T = P.A.t;
    const warn = [...P.A.crew, ...P.fetchAll, P.A.lamb].flatMap((x) => x?.warn || []);
    return `${P.shabbat ? 'incoming mishmar · ' : ''}lamb out ${f(T.leadOut)} · cut ${f(T.tCut)} · hang ${f(T.cuts.hang)} · laid ${f(T.laid[0])} · logs ${f(P.logs?.lay)} · return ${f(P.ret.pickM)} · props ${s.props.shown}/${s.props.count}${warn.length ? `\n   ⚠ ${warn.slice(0, 4).join(' · ')}` : ''}`;
  },
};

function plan(ctx, sim, state) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const P = state.P;
  const Wall = tamidWindows(ctx, sim);
  const { A, up, logs } = planAfternoon(ctx, P, Wall);
  const [u0, u1] = Wall.a.up;
  const items = [...A.items];
  const wineEnd = Wall.a.wine ? Wall.a.wine[0] + 0.5 : u1 + 1;
  for (const it of items) {
    if (it.part != null) it.show = [it.show[0], it.part === 8 ? wineEnd : up.picks[it.part] ?? u0 + 2];
    it.show = it.show.map(wrap);
    it.keys = it.keys.map((k) => ({ ...k, t: wrap(k.t) }));
  }
  state.props.setPlan(items);
  // ---- the vessels back to Lishkat HaKelim ⚙ — by the two who fetched the lamb
  const ret = buildReturn(P, u1, A.fetch);
  const shabbat = ctx.time?.dayType === 'shabbat';
  const P2 = {
    A, ret, logs, shabbat,
    fetchAll: [A.fetch[0], A.fetch[1]],
    crewAll: [...A.crew, A.fetch[0], A.fetch[1]],
    fetcher: (S) => (shabbat ? S.crewS.slot(CREW_N) : S.fetchW.slot(0)),
    slaughterer: (S) => (shabbat ? S.crewS : S.crewW).slot(CREW.S),
    leads: A.leads.map(([a, b, who]) => [wrap(a), wrap(b), who]),
    cue: {
      bleat: wrap(A.t.ledFrom + 0.1), drink: wrap(A.t.drink[0] + 0.1), struggle: wrap(Math.max(A.t.struggle, Wall.a.slaughter[0] + 0.5)), cut: wrap(A.t.tCut + 0.05),
      throw1: wrap(A.t.throw1), throw2: wrap(A.t.throw2), hang: wrap(Math.max(A.t.cuts.hang, Wall.a.flay[0] + 0.5)), laid: wrap(A.t.laid[0]), toss: wrap(up.tossAt[0]),
      logs: logs ? wrap(logs.lay) : NaN,
    },
    near: { chamber: [203, 395, 16], water: A.lambWater, ring: A.ring, hook: A.hook, ramp: [212, 284, 18], altar: [217, 321, 25] },
  };
  state.plan = P2;
  state.planGen = sim.generation;
  return P2;
}

function cues(ctx, S, P, sim) {
  const c = P.cue, n = P.near;
  const say = (key, tc, at, text, id, dur = 6, sound) => {
    if (!Number.isFinite(tc) || !crossed(S, tc)) return;
    cueAt(S, `${key}:${Math.round(tc * 10)}`, tc, () => {
      if (sound) sim.sound(sound[0], at, sound[1]);
      if (text && playerNear(ctx, at, NEAR)) sim.caption(text, { id, duration: dur });
    });
  };
  say('bleat', c.bleat, n.chamber, null, 'pm-lamb', 4, ['sheep', { kind: 'lamb' }]);
  say('drink', c.drink, n.water, { en: 'The afternoon lamb is given water from the gold cup and inspected again before the slaughter, as in the morning (Tamid 3:4)', he: 'הִשְׁקוּ אֶת הַתָּמִיד' }, 'pm-water', 5, ['sheep', { kind: 'lamb' }]);
  say('struggle', c.struggle, n.ring, null, 'pm-bound', 4, ['sheep', { kind: 'lamb' }]);
  say('cut', c.cut, n.ring, { en: P.shabbat ? 'Eight and a half hours: the incoming watch slaughters the afternoon tamid at the north-east corner, on the second ring (Pesachim 5:1; Tamid 4:1; Sukkah 56b)' : 'Eight and a half hours: the afternoon tamid is slaughtered at the north-east corner, on the second ring (Pesachim 5:1; Tamid 4:1)', he: 'שֶׁל בֵּין הָעַרְבַּיִם הָיָה נִשְׁחָט עַל קֶרֶן מִזְרָחִית צְפוֹנִית' }, 'tamid-afternoon', 7);
  say('throw1', c.throw1, n.altar, { en: 'The blood: the north-east corner, then the south-west, the rest on the southern base (Tamid 4:1)', he: 'זְרִיקַת הַדָּם' }, 'pm-blood');
  say('hang', c.hang, n.hook, { en: 'Hung from the hook and flayed in the morning\'s order (Tamid 4:2–3)', he: 'הֶפְשֵׁט וְנִתּוּחַ' }, 'afternoon-flaying');
  say('laid', c.laid, n.ramp, { en: 'The parts laid on the lower half of the ramp, west side, and salted — all but the wine (Tamid 4:3)', he: 'וּמְלָחוּם' }, 'pm-ramp');
  say('toss', c.toss, n.altar, { en: 'Nine and a half hours: eleven kohanim bring up the limbs and two logs; the evening half of the chavitin follows (Pesachim 5:1; Yoma 2:5; Menachot 4:5)', he: 'בֵּין הָעַרְבַּיִם בְּאַחַד עָשָׂר' }, 'afternoon-limbs', 7);
}

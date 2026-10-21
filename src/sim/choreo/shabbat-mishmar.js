// The changeover of the watches on Shabbat: the showbread divided (Sukkah 5:7–8, 56b; Menachot 11:7, 11:9;
// Rambam Temidin uMusafin 4:9–12; report §27.3).
//
// Event served (choreo 'shabbat-mishmar'):
//   showbread-divided  once the frankincense is burned (TuM 4:10) the old loaves are taken from the gold table in the Ulam:
//                      the outgoing watch carries its six to the south of Ezrat Kohanim, the incoming its six to the
//                      north — "the incoming divide in the north, the outgoing in the south", so all can see who is
//                      arriving and who is going home. Each group stands round the one holding the bread; each man comes
//                      up in turn for his piece; they eat it where they stand (most-holy bread, eaten in the court by
//                      male kohanim, on its ninth day — Menachot 11:9), then go back into Lishkat HaGazit by turns.
// Bilgah always divided in the south, its ring fixed and its window sealed (Sukkah 5:8; 56b): the sealed niche is built
// in the south wing of the Beit HaChalifot (heichal builder); the caption tells it. The anonymous Mishnah's six and six is
// shown (R' Yehudah: seven and five). The plan is shared with shabbat-showbread (g6/bread.js): the four of the outgoing
// who took the bread out, and the two of the incoming who burned the frankincense, continue here from the division's
// start without a seam (same pool seeds, same place and heading).
//   showbread-eaten    the Kohen Gadol's half of each watch's loaves (Rambam TuM 4:14; Yoma 17b): two of his kohanim
//                      take it off each stack from its leader first, before the shares ("he takes a portion first",
//                      Yoma 1:2, 17b; "not by division", Rambam MK 10:18), and bring it to him, east of the
//                      altar; he and they eat it standing in the court (Rambam MK 10:3, 10:7–8; BhB 7:6), and other
//                      kohanim come out of the Gazit by turns for a piece until the afternoon lottery ⚙ (who ate with him
//                      and for how long is not recorded). The Kohen Gadol is G2 / G3's (the same face as at the tamid).
import { runScripts, FreeProps } from './g2/lib.js';
import { wrap } from '../lib/core.js';
import { CUE_LEAD } from '../lib/cue.js';
import { breadPlan, SEED_OUT, SEED_IN, N_SIDE, SEED_KG, SEED_KGK, N_KGK } from './g6/bread.js';
import { say } from './g6/common.js';

const TEXT = {
  divide: { en: 'The loaves are divided between the watches: the incoming take six and divide them in the north, for they are ready for the service; the outgoing take six and divide them in the south (Sukkah 5:8; Rambam TuM 4:12)', he: 'הַנִּכְנָסִין חוֹלְקִין בַּצָּפוֹן, וְהַיּוֹצְאִין בַּדָּרוֹם' },
  bilgah: { en: 'Bilgah always divided in the south: its ring was fixed and its window sealed (Sukkah 5:8) — the sealed knife-niche in the south wing of the Beit HaChalifot', he: 'בִּלְגָּה לְעוֹלָם חוֹלֶקֶת בַּדָּרוֹם, וְטַבַּעְתָּהּ קְבוּעָה, וְחַלּוֹנָהּ סְתוּמָה' },
  eat: { en: 'The kohanim eat the bread in the court, on the ninth day after it was baked (Menachot 11:9). Since Shimon HaTzaddik each man\'s share is a bean\'s worth: the modest draw back their hands, the greedy take and eat (Yoma 39a)', he: 'כָּל כֹּהֵן מַגִּיעוֹ כְּפוֹל; הַצְּנוּעִין מוֹשְׁכִין אֶת יְדֵיהֶן' },
  kgHalf: { en: 'Before the shares, half of each watch\'s loaves are taken for the Kohen Gadol — whole loaves, never a broken piece: "half to Aharon and half to his sons". He takes a portion first, not by division (Yoma 1:2, 17b; Rambam TuM 4:14, MK 10:18)', he: 'כֹּהֵן גָּדוֹל נוֹטֵל חֵלֶק בָּרֹאשׁ' },
  kgEat: { en: 'The Kohen Gadol\'s loaves are eaten in the court by male kohanim, standing, that day and the night until midnight (Rambam MK 10:3, 10:7–8; BhB 7:6)', he: 'בְּמָקוֹם קָדֹשׁ יֹאכְלֻהוּ' },
};

export default {
  id: 'shabbat-mishmar',
  lead: 3.6,        // the rest of each watch, and the Kohen Gadol with his two (D0 − 3.4), come out of the Gazit before the bread
  lag: 4,           // … and go back in by turns (the Kohen Gadol's party is in by showbread-eaten.t1 − 3.5)
  importance: 2,

  init(ctx, events, sim) {
    sim.setBounds([85, 270, 0], [252, 400, 30]);
    const state = {
      O: sim.pool({ name: 'outgoing', role: 'kohen', count: N_SIDE, seed: SEED_OUT, importance: 2 }),
      I: sim.pool({ name: 'incoming', role: 'kohen', count: N_SIDE, seed: SEED_IN, importance: 2 }),
      // the Kohen Gadol (G2 / G3's seed: the same man as at the tamid) and the kohanim who eat his loaves with him
      KG: sim.pool({ name: 'kohen-gadol', role: 'kohen_gadol', count: 1, seed: SEED_KG, importance: 2 }),
      K: sim.pool({ name: 'kg-kohanim', role: 'kohen', count: N_KGK, seed: SEED_KGK, importance: 1 }),
      props: new FreeProps(ctx),
      plan: null, planGen: -1, out: {}, fnsO: [], fnsI: [], fnsG: [], fnsK: [], kgList: [],
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const B = plan(ctx, sim, state);
    if (!B) { state.props.hideAll(); return; }
    runScripts(ctx, state.O, B.divO, t, state.out, state.fnsO);
    runScripts(ctx, state.I, B.divI, t, state.out, state.fnsI);
    if (B.kg) {
      runScripts(ctx, state.KG, state.kgList, t, state.out, state.fnsG);
      runScripts(ctx, state.K, B.kg.K, t, state.out, state.fnsK);
    }
    state.props.update(t);
    const c = state.cue, at = B.at;
    say(ctx, state, sim, 'mm-divide', c.divide, at.north, TEXT.divide, { id: 'showbread-divided', dur: 9, range: 60 });
    say(ctx, state, sim, 'mm-bilgah', c.bilgah, at.south, TEXT.bilgah, { id: 'bilgah', dur: 9, range: 60 });
    say(ctx, state, sim, 'mm-eat', c.eat, at.north, TEXT.eat, { id: 'showbread-eaten', dur: 8, range: 60 });
    if (B.kg) {
      say(ctx, state, sim, 'mm-kg-half', c.kgHalf, B.kg.at.kg, TEXT.kgHalf, { id: 'showbread-kg', dur: 8, range: 60 });
      say(ctx, state, sim, 'mm-kg-eat', c.kgEat, B.kg.at.kg, TEXT.kgEat, { id: 'showbread-kg-eat', dur: 8, range: 60 });
    }
  },

  release(ctx, state) { state.props.hideAll(); },

  debug(s) {
    const B = s.plan, f = s.fmt;
    if (!B) return 'no plan (not Shabbat)';
    const T = B.t;
    const K = B.kg?.t;
    return `bread taken ${f(T.takeOld[0])}/${f(T.takeOld[1])} · shares N ${f(T.startN)}–${f(T.endN)} · S ${f(T.startS)}–${f(T.endS)} · ${B.div.map(f).join('–')}${K ? `
   Kohen Gadol's loaves: taken ${f(K.take)} · broken up ${f(K.share)} · ${K.visits.length} visits · in ${f(K.end)}` : ''}`;
  },
};

function plan(ctx, sim, state) {
  if (state.planGen === sim.generation) return state.plan;
  state.planGen = sim.generation;
  const B = breadPlan(ctx, sim);
  state.plan = B;
  state.props.setPlan(B ? B.items.div : []);
  if (B) {
    const D0 = B.div[0];
    state.cue = { divide: wrap(D0 + 0.55), bilgah: wrap(B.t.startS + 0.8), eat: wrap(B.t.endN + 0.6) };
    if (B.kg) {
      // the Kohen Gadol's half as the first comes off its stack (the north's); his meal at showbread-eaten's start
      // (after CUE_LEAD)
      const ev = sim.event('showbread-eaten');
      state.cue.kgHalf = wrap(B.kg.t.half + 0.1);
      state.cue.kgEat = wrap((Number.isFinite(ev?.t0) ? ev.t0 : B.kg.t.share) + CUE_LEAD + 0.2);
    }
  }
  state.kgList = B?.kg ? [B.kg.KG] : [];
  return B;
}

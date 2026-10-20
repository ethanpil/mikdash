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
import { runScripts, FreeProps } from './g2/lib.js';
import { wrap } from '../lib/core.js';
import { breadPlan, SEED_OUT, SEED_IN, N_SIDE } from './g6/bread.js';
import { say } from './g6/common.js';

const TEXT = {
  divide: { en: 'The loaves are divided between the watches: the incoming take six and divide them in the north, for they are ready for the service; the outgoing take six and divide them in the south (Sukkah 5:8; Rambam TuM 4:12)', he: 'הַנִּכְנָסִין חוֹלְקִין בַּצָּפוֹן, וְהַיּוֹצְאִין בַּדָּרוֹם' },
  bilgah: { en: 'Bilgah always divided in the south: its ring was fixed and its window sealed (Sukkah 5:8) — the sealed knife-niche in the south wing of the Beit HaChalifot', he: 'בִּלְגָּה לְעוֹלָם חוֹלֶקֶת בַּדָּרוֹם, וְטַבַּעְתָּהּ קְבוּעָה, וְחַלּוֹנָהּ סְתוּמָה' },
  eat: { en: 'The kohanim eat the bread in the court, on the ninth day after it was baked (Menachot 11:9). Since Shimon HaTzaddik each man\'s share is a bean\'s worth: the modest draw back their hands, the greedy take and eat (Yoma 39a)', he: 'כָּל כֹּהֵן מַגִּיעוֹ כְּפוֹל; הַצְּנוּעִין מוֹשְׁכִין אֶת יְדֵיהֶן' },
};

export default {
  id: 'shabbat-mishmar',
  lead: 3,          // the rest of each watch comes out of the Gazit before the bread is brought
  lag: 4,           // … and goes back in by turns
  importance: 2,

  init(ctx, events, sim) {
    sim.setBounds([85, 270, 0], [252, 400, 30]);
    const state = {
      O: sim.pool({ name: 'outgoing', role: 'kohen', count: N_SIDE, seed: SEED_OUT, importance: 2 }),
      I: sim.pool({ name: 'incoming', role: 'kohen', count: N_SIDE, seed: SEED_IN, importance: 2 }),
      props: new FreeProps(ctx),
      plan: null, planGen: -1, out: {}, fnsO: [], fnsI: [],
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
    state.props.update(t);
    const c = state.cue, at = B.at;
    say(ctx, state, sim, 'mm-divide', c.divide, at.north, TEXT.divide, { id: 'showbread-divided', dur: 9, range: 60 });
    say(ctx, state, sim, 'mm-bilgah', c.bilgah, at.south, TEXT.bilgah, { id: 'bilgah', dur: 9, range: 60 });
    say(ctx, state, sim, 'mm-eat', c.eat, at.north, TEXT.eat, { id: 'showbread-eaten', dur: 8, range: 60 });
  },

  release(ctx, state) { state.props.hideAll(); },

  debug(s) {
    const B = s.plan, f = s.fmt;
    if (!B) return 'no plan (not Shabbat)';
    const T = B.t;
    return `bread taken ${f(T.takeOld[0])}/${f(T.takeOld[1])} · shares N ${f(T.startN)}–${f(T.endN)} · S ${f(T.startS)}–${f(T.endS)} · ${B.div.map(f).join('–')}`;
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
  }
  return B;
}

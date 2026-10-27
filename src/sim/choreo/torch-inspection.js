// The inspection of the Azarah before dawn (Tamid 1:3; Middot 1:7; Rambam BhB 8:11–12; report Part VIII §28 row 3).
// Events served (choreo 'torch-inspection'):
//   torch-inspection         the officer takes the key from under the slab, opens the wicket in the Moked gate's east
//                            leaf and goes into the court; the kohanim follow with two burning torches, part into two
//                            companies — one along the colonnade by the east, one by the west (site.js
//                            azarah.achsadra-route, reconstruction), stopping to look as they go — until both reach the
//                            chamber of the chavitin makers: "Shalom — all is well"; the bakers are set to work —
//                            the officer lays the torches by their griddle, then walks back through the court to Beit
//                            HaMoked by its wicket and waits there until the second lottery.
//   lamp-inspection-shabbat  the same on Shabbat night with no light in hand: they search by the lamps lit before Shabbat
//                            (Rambam BhB 8:12).
// The five kohanim and the officer are the first lottery's (g1/plan.js); at the end the officer takes the torches into
// the chavitin chamber ⚙ and the five stand where terumat-hadeshen's winner and brothers take over (same seeds) at
// muchni.t0 − 0.8; the officer goes back to Beit HaMoked through the court, where lotteries.js takes him at the second
// lottery's t0 − 4.75. Every pose is a pure function of (t, date).
import { nightPlan } from './g1/plan.js';
import { makePools, stage, runCues, windowAmount } from './g1/stage.js';
import { torchInspection as inspectHooks } from './describe/dawn.js';

export default {
  id: 'torch-inspection',
  // inspect hooks (console-design §6.2): who each figure is and what it is doing; no behaviour change
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  lead: 1,
  lag: 38,          // the officer waits in Beit HaMoked until he goes to the second lottery (alot − 12.75)
  importance: 3,

  init(ctx, events, sim) {
    sim.setBounds([65, 262, 10], [252, 396, 30]);
    return {
      pools: makePools(sim, ['young:k', 'slab:k', 'officer:k'], 3, { 'young:k': { prop: 'torch' } }),
      wicket: sim.door('azarah.gate.moked.pishpash'),
      plan: null, fmt: (m) => ctx.time?.format?.(m) ?? '--', n: 0,
    };
  },

  update(ctx, state, t, dt, sim) {
    const P = nightPlan(ctx, sim);
    state.plan = P;
    state.n = stage(ctx, sim, state.pools, P, 'insp', t);
    const a = windowAmount(t, P.insp.pishWins, 0.25);
    if (a > 0) state.wicket.set(a);
    runCues(ctx, sim, state, P.cues, 'insp');
  },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan';
    return `figures ${s.n} · ${P.T.torches ? 'torches' : 'lamps (Shabbat)'} · east ${f(P.comp.east.t0)}→${f(P.comp.east.tEnd)} · west ${f(P.comp.west.t0)}→${f(P.comp.west.tEnd)} · meet ${f(P.meet.t)} · hand ${f(P.insp.hand)}`;
  },
};

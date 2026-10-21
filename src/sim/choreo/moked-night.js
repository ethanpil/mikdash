// Beit HaMoked through the night, from the locking to the morning (Middot 1:6–9; Tamid 1:1–2; Rambam BhB 8:5–7, 8:11;
// Yoma 20b; report Part VIII §28 rows 1–2, §34.1). One module for one continuous scene with the same people, so it
// also serves the schedule's 'locking-up' and 'moked-dawn' events (aliases):
//   locking-up      the kohen lifts the keys slab by its ring, takes the keys, locks from within (the Korban gate, then
//                   the Moked's own gate from inside the hall), hangs the keys back, sets the slab, spreads his garment on
//                   it and sleeps on it; a Levite sleeps outside, at the foot of the Moked's flight (Middot 1:9).
//   moked-night     the elders of the beit av asleep on the rovadin; the young kohanim on their mats on the floor of the
//                   chol half in their own clothes, the holy garments folded beside their heads (Tamid 1:1; Rambam BhB
//                   8:6) — four mats is what the floor holds clear of the hearth and the chel door's leaves (g1/plan.js
//                   floorPlan); on Friday night two sit up by the east ledges; the hearth burning; the altar's evening
//                   crew coming in at midnight (Friday: at sunset) to sleep.
//   mesibah-keri    a kohen who became impure goes down the winding stair and walks the lamp-lit passage under the Birah
//                   to the Beit HaTevilah as the event begins, immerses, stands drying and warming himself at the fire
//                   (seen down the passage) and comes back along it as it ends, to sit by his brothers until the gates
//                   open, when he goes out over the Mount (Tamid 1:1; Middot 1:9; Rambam BhB 8:7).
//   dawn-immersion  those who want to clear the altar rise early, go down with their folded garments as a pair and then a
//                   trio, immerse, stand drying, warm themselves at the fire, dress and wait for each other, so someone is
//                   always at the mikveh through the event, and come back up to wait by the hearth (Tamid 1:1–2).
//   gevini          Gevini the crier at the head of the fifteen steps (Yoma 20b).
//   memuneh-knock   the officer comes up the flight and knocks; two elders open; "whoever has immersed — come and cast
//                   lots!" (Tamid 1:2).
// The first lottery and the torch inspection (lotteries, torch-inspection) continue the same people. Every pose is a pure
// function of (t, date): the night is planned once per date in g1/plan.js. ⚙ marks reconstruction (minutes, spots).
import { nightPlan } from './g1/plan.js';
import { makePools, stage, runCues, windowAmount, FreeProps } from './g1/stage.js';
import { within, window4, since } from '../lib/core.js';

const POOLS = ['young:off', 'young:k', 'young:bath', 'keri:off', 'keri:k', 'keri:bath', 'slab:off', 'slab:k', 'slab:bath', 'elders:elder', 'elders:eoff',
  'levite:guard', 'officer:k', 'gevini:levi'];
const SLAB = 'azarah.moked.keys-slab';
const SLAB_UP = 0.75;      // how far the tablet is raised by its ring (world: 1 = 80°) ⚙

export default {
  id: 'moked-night',
  aliases: ['locking-up', 'moked-dawn'],
  lead: 45,         // before the locking: on Friday the altar's crew come in to sleep at sunset (≈ tzeit − 37)
  lag: 190,         // the residents stay until the gates open in the morning (sunrise − 6), then go out ⚙
  importance: 2,

  init(ctx, events, sim) {
    sim.setBounds([60, 250, -16], [300, 470, 40]);
    return {
      pools: makePools(sim, POOLS, 2, { 'officer:k': { importance: 3 }, 'gevini:levi': { importance: 3 }, 'slab:off': { importance: 3 } }),
      chel: sim.door('azarah.moked.door-chel'),
      // the keys slab (Middot 1:9): lifted by its ring through the door contract; the keys on its chain (setKeys)
      slab: sim.door(SLAB), keys: true,
      nw: sim.door('azarah.moked.chamber.tevilah-descent'),
      ne: sim.door('azarah.moked.chamber.altar-stones'),
      props: new FreeProps(ctx),
      plan: null,
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
      n: 0,
    };
  },

  update(ctx, state, t, dt, sim) {
    const P = nightPlan(ctx, sim);
    if (state.plan !== P) {
      state.plan = P;
      state.props.set(P.props.filter((p) => p.owner === 'moked'));
    }
    state.n = stage(ctx, sim, state.pools, P, 'moked', t);
    state.props.update(t);
    // the chel door: the elders open it for the officer; it opens for the impure kohen leaving in the morning
    const a = windowAmount(t, P.doors.chel, 0.3);
    if (a > 0) state.chel.set(a);
    // the corner chambers' doors: shut through the night, the stair chamber's open while men go down and up
    if (P.doors.night && within(t, P.doors.night[0], P.doors.night[1])) {
      state.nw.set(windowAmount(t, P.doors.nw, 0.2));
      state.ne.set(0);
    }
    // the keys slab: raised while the locking kohen and the officer take and return the keys (Middot 1:9; Tamid 1:3)
    let lift = 0;
    for (let i = 0; i < P.slab.length; i++) {
      const w = P.slab[i], e = since(t, w[0]);
      if (e <= w[3] - w[0]) lift = Math.max(lift, (w[4] ?? SLAB_UP) * window4(e, 0, w[1] - w[0], w[2] - w[0], w[3] - w[0]));
    }
    if (lift > 0) state.slab.set(lift);
    setKeys(ctx, state, keysAt(P, t));
    runCues(ctx, sim, state, P.cues, 'moked');
  },

  release(ctx, state) { state.props.hide(); setKeys(ctx, state, true); },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan';
    const T = P.T;
    return `figures ${s.n} · lock ${f(T.lock[0])} · keri ${T.keri ? f(T.keri[0]) : '-'} · imm ${f(T.imm[0])} · gevini ${f(P.gevini?.tCall)} · knock ${f(T.knock[0])} · out ${f(T.mokedGateOpen)}`;
  },
};

/** the keys on the chain at t: all (true); none while the locking kohen has them (false); all but the wicket's (7)
 *  while the officer has it (P.keysWin = [[t0, t1, state]]) */
function keysAt(P, t) {
  for (let i = 0; i < P.keysWin.length; i++) {
    const [a, b, v] = P.keysWin[i];
    if (Number.isFinite(a) && Number.isFinite(b) && within(t, a, b)) return v;
  }
  return true;
}

/** world: azarah.moked.keys-slab setKeys(true | false | n) — change-cached */
function setKeys(ctx, state, v) {
  if (state.keys === v) return;
  const ud = ctx.movables?.get?.(SLAB)?.userData;
  if (typeof ud?.setKeys !== 'function') return;
  state.keys = v;
  ud.setKeys(v);
}

// Beit Avtinas compounds the incense (group G4; choreo 'beit-avtinas', event 'avtinas-compounding'). The event is
// 'occasional' — reference only, never on the daily clock (schedule.js: how often the incense was compounded is not
// given) — so this module stages it only if a date ever makes it active.
//   In their upper room over the Water Gate (Tamid 1:1; report lock #20) the house of Avtinas grinds and blends the
//   spices; as the grinder pounds he says "Grind it fine — fine, grind it", for the voice is good for the spices
//   (Keritot 6b). They come up the gatehouse's winding stair to the roof terrace and along it to the room's door.
import { rand, smooth } from '../lib/core.js';
import { crossed } from '../lib/cue.js';
import { Itin, Troupe, daySeed, win, hm, observerNear } from './g4/lib.js';
import { avtinas as inspectHooks } from './describe/courts.js';

const SEED = 0x6176;
// azarah.beit-avtinas: X 195.75–215.75, Y 258–263, floor +36; worktable along the south wall with four stone mortars,
// a stone bench along the north wall, the door at the east end (courts/azarah.js) ⚙
const STAIR_HEAD = [223.0, 261.6, 36];
const WAY = [STAIR_HEAD, [221.6, 261.7, 36], [216.6, 261.7, 36], [214.2, 261.6, 36]];
const POSTS = [
  { at: [198.75, 260.05, 36], face: 180, poses: [['sweep', null, 3], ['stand', null, 1]] },   // pounding at a mortar
  { at: [205.95, 260.05, 36], face: 180, poses: [['sweep', null, 3], ['kemitzah', null, 1]] },
  { at: [202.0, 261.34, 35.9 + 0.0], face: 180, sit: true, poses: [['sit', null, 1]] },          // sorting on the bench
];

export default {
  id: 'beit-avtinas',
  // inspect hooks (console-design §6.2): who each figure is and what it is doing; no behaviour change
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  lead: 6,
  lag: 6,
  importance: 1,

  init(ctx, events, sim) {
    sim.setBounds([190, 250, 30], [230, 270, 48]);
    return { pool: sim.pool({ name: 'avtinas', role: 'kohen', count: 3, seed: SEED, importance: 1, prop: null }), plan: null, planGen: -1, troupes: [], fmt: (m) => ctx.time?.format?.(m) ?? hm(m) };
  },

  update(ctx, state, t, dt, sim) {
    if (state.planGen !== sim.generation) {
      const W = win(sim, 'avtinas-compounding');
      const seed = daySeed(ctx, SEED);
      state.plan = { W, chants: [] };
      state.troupes = [];
      if (W) {
        const [w0, w1] = W;
        const planFn = (k) => {
          const S = POSTS[k];
          const it = new Itin();
          it.walkTo([...WAY, [S.at[0] + 1.2, 261.6, 36], [S.at[0], S.sit ? 261.6 : S.at[1], 36]], 1.0);
          const mark = it.T;
          let left = w1 - w0 - 0.5 * k, n = 0;
          if (S.sit) { it.stand(Math.max(1, left), S.face, { pose: 'sit', at: [S.at[0], S.at[1], 35.9], ease: 0.012, prop: 'bowl' }); left = 0; }
          while (left > 0.05 && n < 2000) {
            const p = S.poses[Math.floor(rand(seed, 'p', k, n) * S.poses.length)];
            const d = Math.min(left, 1 + 3 * rand(seed, 'd', k, n));
            it.stand(d, S.face, { pose: p[0], prop: p[1], at: S.at, turn: n === 0 });
            left -= d; n++;
          }
          it.walkTo([[S.at[0], S.sit ? 261.6 : S.at[1], 36], [S.at[0] + 1.2, 261.6, 36], ...[...WAY].reverse()], 1.0);
          it.done();
          return [{ t0: w0 + 0.6 * k - mark, T: it.T, it }];
        };
        state.troupes.push(new Troupe(state.pool, { plan: planFn, legs: (e) => e.it }));
        // the grinder's chant every few minutes while they pound (Keritot 6b)
        for (let c = w0 + 4; c < w1 - 2; c += 3 + 3 * rand(seed, 'c', Math.round(c))) state.plan.chants.push({ at: c, key: `chant:${Math.round(c * 10)}` });
      }
      for (const tr of state.troupes) tr.replan(sim.generation);
      state.planGen = sim.generation;
    }
    for (const tr of state.troupes) tr.update(ctx, sim, t);
    if (!sim.crossing.ok) return;
    for (const c of state.plan.chants) {
      if (!crossed(state, c.at)) continue;
      sim.cueAt(c.key, c.at, () => {
        if (!observerNear(ctx, [204, 260.5, 36], 30)) return;
        sim.sound('grinder-chant', [199, 260, 37]);
        sim.caption({ en: '"Grind it fine — fine, grind it": the voice is good for the spices (Keritot 6b)', he: 'הָדֵק הֵיטֵב, הֵיטֵב הָדֵק' }, { id: 'avtinas', duration: 5 });
      });
    }
  },

  debug(s) { return s.plan?.W ? `${s.fmt(s.plan.W[0])}–${s.fmt(s.plan.W[1])}` : 'not today (occasional)'; },
};

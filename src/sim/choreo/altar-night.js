// The altar through the evening and the night (report Part VIII §28 row 1; Rambam MK 4:2–3, TuM 1:6–7; Tamid 2:1;
// Zevachim 9:6; Berachot 1:1; Megillah 2:6). Events served (choreo 'altar-night'):
//   fats-burning           the great pile burns all night with the day's limbs and fats; the fire alone when no one tends it.
//   evening-altar          (weekday) four kohanim from the end of the afternoon service until midnight: the last limbs and
//                          fats carried up the ramp's east half from where they lie salted on its lower west half
//                          (Tamid 4:3) and laid on the fire; the pile tended with forks; a log now and then ⚙; a limb that
//                          springs off is put back before midnight (Zevachim 9:6).
//   friday-last-fats       (Friday) the same, until sunset only: the end of a weekday's offerings does not override
//                          Shabbat (Rambam TuM 1:7 with the Kesef Mishneh; Yoma 46a); they go in to sleep and the pile is
//                          left to burn by itself through Friday night.
//   shabbat-evening-altar  (Shabbat) three kohanim put Shabbat's own limbs and fats on the fire before sunset and arrange
//                          them (Rambam MK 4:3); after it they only tend them, until midnight.
//   late-turning           after midnight nothing new goes on; one kohen turns what lies there now and then (TuM 1:6).
//   night-turning          the same in the small hours (not on Shabbat's: Friday night is left alone); he goes in to
//                          immerse before the officer comes (moked-night picks him up at the Moked's wicket).
// The kohanim are in the four white garments, barefoot (on duty). The crew's men go to sleep in Beit HaMoked (the shared
// plan, g1/plan.js); every pose is a pure function of (t, date). The great pile's fire is eased (ctx.fx.setFire) only
// in this module's night window, back to the builder's level before terumat-hadeshen takes it over.
import { nightPlan, LEFT } from './g1/plan.js';
import { makePools, stage, runCues, windowAmount, FreeProps } from './g1/stage.js';
import { within, since, clamp, smooth, upperBound, wrap } from '../lib/core.js';
import { CUE_LEAD } from '../lib/cue.js';

const FIRES = { great: 'altar.maarachah.great', inner: 'altar.maarachah.great.inner' };
const FIRE_DEFAULT = { great: 1, inner: 0.9 };     // as the altar builder lights them
const LIMB_BURNS = 240;                            // minutes a limb or fat stays visible on the fire ⚙
const TEXT = {
  limbsUp: { en: 'The last of the day\'s limbs and fats go up the ramp and onto the great pile; the kohanim tend it with forks (Rambam MK 4:2; Tamid 2:1)', he: 'מַעֲלִין אֵבָרִים וּפְדָרִים לַמַּעֲרָכָה' },
  spring: { en: 'A limb has sprung off the fire: before midnight it is put back (Zevachim 9:6)', he: 'אֵבָרִים שֶׁפָּקְעוּ מֵעַל גַּבֵּי הַמִּזְבֵּחַ, קֹדֶם לַחֲצוֹת — יַחֲזִיר' },
  midnight: { en: 'Midnight: nothing more is put on the fire; what lies on it is turned until the morning (Rambam MK 4:2; TuM 1:6)', he: 'אֵין מַקְטִירִין אַחַר חֲצוֹת, אֲבָל מְהַפְּכִין' },
  fridaySunset: { en: 'Sunset on Friday: the day\'s fats may not go on the fire on Shabbat. The pile burns by itself through the night (Rambam TuM 1:7)', he: 'אֵין סוֹף עוֹלַת חֹל קָרֵב בְּשַׁבָּת' },
  shabbatSunset: { en: 'Shabbat\'s own limbs and fats are on the fire, put there in their time (Rambam MK 4:3); after Shabbat they are tended until midnight', he: 'אֵין מְאַחֲרִין אוֹתָן לְמוֹצָאֵי שַׁבָּת' },
};

export default {
  id: 'altar-night',
  lead: 2.5,        // the evening crew come out of Beit HaMoked 2.3 min before evening-altar (g1/plan.js CREW_LEAD)
  lag: 3,
  importance: 2,

  init(ctx, events, sim) {
    sim.setBounds([195, 268, 14], [245, 345, 32]);
    return {
      pools: makePools(sim, ['young:k'], 2, { 'young:k': { prop: 'fork' } }),
      wicket: sim.door('azarah.gate.moked.pishpash'),
      fireLast: { great: NaN, inner: NaN },
      props: new FreeProps(ctx),
      plan: null, cues: [], fireWin: null,
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
      n: 0, level: NaN,
    };
  },

  update(ctx, state, t, dt, sim) {
    const P = nightPlan(ctx, sim);
    if (state.plan !== P) prepare(ctx, state, P, sim);
    // terumat-hadeshen drives the same fires (uncached): after a jump our last level means nothing
    if (sim.forced) state.fireLast.great = state.fireLast.inner = NaN;
    state.n = stage(ctx, sim, state.pools, P, 'altar', t);
    state.props.update(t);
    const a = windowAmount(t, P.altar.wicket, 0.2);
    if (a > 0) state.wicket.set(a);
    fire(ctx, state, P, t);
    runCues(ctx, sim, state, state.cues, 'altar');
  },

  release(ctx, state, sim) {
    state.props.hide();
    // back to the builder's fire unless terumat-hadeshen owns it now (from muchni.t0 − 0.5 to the second pile's end)
    const t = ctx.time?.t;
    const W = state.fireWin;
    if (W && Number.isFinite(t) && within(t, W.g2[0], W.g2[1])) { state.level = NaN; state.fireLast.great = state.fireLast.inner = NaN; return; }
    if (Number.isFinite(state.level)) {
      state.fireLast.great = state.fireLast.inner = NaN;
      setFire(ctx, state, 'great', FIRE_DEFAULT.great); setFire(ctx, state, 'inner', FIRE_DEFAULT.inner);
      state.level = NaN;
    }
    state.fireLast.great = state.fireLast.inner = NaN;
  },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan';
    const T = P.T, A = P.altar;
    return `figures ${s.n} · eve ${T.eve ? `${T.eve.id} ${f(T.eve.t0)}–${f(T.eve.t1)} crew ${P.crew.length}` : '-'} · carries ${A.carries?.length ?? 0} wood ${A.woods?.length ?? 0} · late ${T.late ? f(T.late[0]) : '-'} · night ${T.nightTurn ? 'yes' : 'no'} · fire ${Number.isFinite(s.level) ? s.level.toFixed(2) : '-'}`;
  },
};

function prepare(ctx, state, P, sim) {
  state.plan = P;
  const A = P.altar, T = P.T, ap = P.A;
  // free props: the limbs lying salted on the ramp until carried up; on the fire from the toss until burnt ⚙; and, in
  // the small hours, what still lies on the fire from the evening (none left by the time terumat-hadeshen clears it)
  const mu = sim.schedule.byId('muchni'), sp = sim.schedule.byId('second-pile');
  // terumat-hadeshen shows the last of them (limb_gerah at onPile[4]) from muchni.t0 − 2: handed over there
  const cut = Number.isFinite(mu?.t0) ? wrap(mu.t0 - 2) : wrap((T.alot ?? 285) - 52);
  const items = [];
  for (const s of A.stack) items.push({ name: s.name, at: s.at, h: s.h, show: [s.from, s.until ?? s.from] });
  // (the evening's last limbs stay on the fire to 24:00, where the small hours' leftovers continue them — LEFT)
  for (const p of A.pile) items.push({ name: p.name, at: p.at, h: p.h, show: [p.from, p.persist ? 1439.999 : Math.min(p.from + LIMB_BURNS, 1439.9)] });
  if (T.nightTurn || P.T.fats) LEFT.forEach((L, k) => {
    // consumed one by one through the small hours; the last is terumat-hadeshen's leftover limb at dawn
    const end = k === LEFT.length - 1 ? (cut < 720 ? cut : 300) : Math.min(cut < 720 ? cut : 300, 80 * (k + 1) + (T.nightTurn ? 60 : 0));
    items.push({ name: L.name, at: ap.onPile[L.idx], h: L.h, show: [0, Math.max(1, end)] });
  });
  state.props.set(items);
  // the fire's window: from sunset (fats-burning) until shortly before terumat-hadeshen takes it (muchni.t0 − 0.5)
  const fw = P.fire?.window;
  // (terumat-hadeshen drives the same fires from muchni.t0 − 0.5: this window ends exactly there, at the builder's level)
  state.fireWin = fw ? {
    w: [fw[0], Number.isFinite(mu?.t0) ? wrap(mu.t0 - 0.5) : fw[1]],
    g2: [Number.isFinite(mu?.t0) ? wrap(mu.t0 - 0.5) : fw[1], Number.isFinite(sp?.t1) ? wrap(sp.t1 + 1) : wrap(fw[1] + 30)],
    back: Number.isFinite(mu?.t0) ? wrap(mu.t0 - 9) : wrap(fw[1] - 8),
  } : null;
  // captions
  const c = [];
  const near = [ap.gx, ap.gy, ap.Zt];
  if (A.tosses?.length && T.eve) c.push({ key: `altar-up:${Math.round(T.eve.t0 * 10)}`, t: Math.max(A.tosses[0], T.eve.t0 + CUE_LEAD), caption: TEXT.limbsUp, at: near, range: 60, owner: 'altar' });
  if (A.spring) c.push({ key: `altar-spring:${Math.round(A.spring.t * 10)}`, t: A.spring.tPick, caption: TEXT.spring, at: near, range: 60, owner: 'altar' });
  if (T.late) c.push({ key: `altar-midnight:${Math.round(T.late[0] * 10)}`, t: T.late[0] + CUE_LEAD, caption: TEXT.midnight, at: near, range: 70, owner: 'altar' });
  if (T.eve?.friday) c.push({ key: `altar-friday:${Math.round(T.eve.t1 * 10)}`, t: T.eve.t1 + 0.3, caption: TEXT.fridaySunset, at: near, range: 70, owner: 'altar' });
  if (T.eve && T.eve.n === 3 && Number.isFinite(T.sunset)) c.push({ key: `altar-shabbat:${Math.round(T.sunset * 10)}`, t: T.sunset + 0.3, caption: TEXT.shabbatSunset, at: near, range: 70, owner: 'altar' });
  state.cues = c;
}

/**
 * The great pile's fire (eased by fx): full with the evening's work, a flare as a limb or a log goes on; lower in the
 * small hours, lower still on Friday night when no one tends it ⚙; back to the builder's level before terumat-hadeshen.
 */
/** the fires through fx, change-cached here (the cache is dropped on jumps and on release: others drive them too) */
function setFire(ctx, state, k, v) {
  if (Math.abs(v - state.fireLast[k]) < 1e-3) return;
  state.fireLast[k] = v;
  try { ctx.fx?.setFire?.(FIRES[k], v); } catch { /* fx missing */ }
}

function fire(ctx, state, P, t) {
  const W = state.fireWin;
  if (!W || !within(t, W.w[0], W.w[1])) {
    // outside the night window: the builder's fire again (unless terumat-hadeshen owns it now)
    if (Number.isFinite(state.level) || Number.isNaN(state.fireLast.great)) {
      if (!(W && within(t, W.g2[0], W.g2[1]))) { setFire(ctx, state, 'great', FIRE_DEFAULT.great); setFire(ctx, state, 'inner', FIRE_DEFAULT.inner); }
      state.level = NaN;
    }
    return;
  }
  const T = P.T, quiet = P.fire.quiet;
  let base = 1;
  // after midnight (and in the small hours) the fire sinks as what lies on it burns down ⚙
  const mid = Number.isFinite(T.midnight) ? T.midnight : 1400;
  if (t >= mid || t < 720) {
    const h = since(t, mid);                                  // minutes since midnight
    base = 1 - (quiet ? 0.3 : 0.16) * smooth(0, 150, h);
    // the clearing is near: the builder's level again (terumat-hadeshen's fire takes over from it)
    base += (1 - base) * smooth(0, 7, since(t, W.back)) * (within(t, W.back, W.w[1]) ? 1 : 0);
  }
  // a flare as a limb, a fat or a log goes on ⚙
  const ts = P.fire.tosses;
  let flare = 0;
  for (let i = Math.max(0, upperBound(ts, t) - 3); i < ts.length && ts[i] <= t; i++) {
    const e = t - ts[i];
    if (e >= 0 && e < 4) flare = Math.max(flare, 0.22 * Math.exp(-e / 1.2));
  }
  const v = clamp(base + flare, 0, 1.25);
  state.level = v;
  setFire(ctx, state, 'great', clamp(v));
  setFire(ctx, state, 'inner', clamp(v * 0.9 + flare * 0.5));
}

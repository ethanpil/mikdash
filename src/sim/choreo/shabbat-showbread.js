// The showbread on Shabbat morning (Menachot 11:7; Shekalim 6:4; Yoma 21a, 33a–34a; Tamid 2:5; Sukkah 56b;
// Rambam Temidin uMusafin 4:9–11; report §38.2, §33.1).
//
// Events served (choreo 'shabbat-showbread'):
//   showbread-swap  four of the incoming watch bring the new bread and bowls of frankincense from Beit Garmu's chamber in
//                   Beit HaMoked to the marble table in the Ulam; four of the outgoing go in before them to the south of
//                   the Shulchan facing north; the four with the bread follow to its north facing south. The old bowls
//                   are lifted off; the old stacks are drawn out to the south as the new are slid on from the north,
//                   "the handbreadth of one beside the handbreadth of the other" — the table is never bare; the new bowls
//                   are set on. The old bread goes out to the gold table in the Ulam (Menachot 11:7; Shekalim 6:4).
//   bread-warm      (aggadah) the week-old loaves on the gold table are as warm as when they were set (Yoma 21a): one of
//                   the four lays his hand on them; with the aggadah layer on, a breath of warmth rises from the loaves.
//   bazichin        after the musafim (Abaye, Yoma 33a) two of the incoming watch (Sukkah 56b) carry the two old bowls up
//                   the ramp and round the top to the incense pile — built of eight se'ah of coals today (Tamid 2:5) —
//                   salt the frankincense (TuM 4:10) and burn it; the empty bowls go back to Lishkat HaKelim ⚙.
// The plan (g6/bread.js) is shared with shabbat-mishmar, which takes the eight and the bread from the division's start.
// Every pose and prop is a pure function of (t, date); cues fire once in continuous play.
import { runScripts, FreeProps, evalScript } from './g2/lib.js';
import { lastNear, stagedRetime, siteOf } from '../lib/watch.js';
import { within, wrap, smooth, clamp, since, span } from '../lib/core.js';
import { breadPlan, SEED_OUT, SEED_IN } from './g6/bread.js';
import { say, aggadahOn } from './g6/common.js';
import { shabbatShowbread as inspectHooks } from './describe/sanctuary.js';

const NEAR = 40;          // m — captions for what is seen close by
const STEAM_MAX = 0.45;   // the warmth's intensity cap: a breath, not a kettle ⚙
const TEXT = {
  bring: { en: 'The new bread, baked by Beit Garmu on Friday, is carried to the marble table in the Ulam — "on the marble table they laid it as it came in" (Menachot 11:7)', he: 'עַל שֻׁלְחַן הַשַּׁיִשׁ נוֹתְנִין לֶחֶם הַפָּנִים בִּכְנִיסָתוֹ' },
  in: { en: 'Four go in with the two stacks and the two bowls of frankincense, and four before them to take the old: those bringing in stand on the north facing south, those taking out on the south facing north (Menachot 11:7)', he: 'הַמַּכְנִיסִין עוֹמְדִין בַּצָּפוֹן וּפְנֵיהֶם לַדָּרוֹם, וְהַמּוֹצִיאִין עוֹמְדִין בַּדָּרוֹם וּפְנֵיהֶם לַצָּפוֹן' },
  slide: { en: 'These draw out and those lay down, the handbreadth of one beside the handbreadth of the other — "before Me always" (Menachot 11:7)', he: 'אֵלּוּ מוֹשְׁכִין וְאֵלּוּ מַנִּיחִין, וְטִפְחוֹ שֶׁל זֶה כְּנֶגֶד טִפְחוֹ שֶׁל זֶה' },
  gold: { en: 'They come out and lay the old loaves on the gold table in the Ulam: it came in on marble and goes out on gold — one goes up in holiness, not down (Menachot 11:7)', he: 'יָצְאוּ וְנָתְנוּ עַל שֻׁלְחַן הַזָּהָב שֶׁהָיָה בָּאוּלָם' },
  warm: { en: 'The week-old bread is as warm as when it was set: "to put warm bread on the day it is taken" — a wonder of the Mikdash (Yoma 21a; Shmuel I 21:7). At the festivals the table was lifted to the pilgrims: "See how beloved you are" (Chagigah 26b)', he: 'סִילּוּקוֹ כְּסִידּוּרוֹ' },
  baz: { en: 'After the musafim two of the incoming watch take the two bowls of frankincense from the gold table to the altar (Yoma 33a; Sukkah 56b; Rambam TuM 4:11)', he: 'וְאַחַר קָרְבַּן הַמּוּסָפִין מַקְטִירִין שְׁנֵי הַבְּזִיכִין' },
  burn: { en: 'Salted like every offering, the frankincense goes on the incense pile — built today of eight se\'ah of coals for it (Tamid 2:5; Rambam TuM 4:10); until it is burned the bread may not be eaten', he: 'וְהַלְּבוֹנָה טְעוּנָה מֶלַח' },
};

// the Shulchan's bread (world-4 / world-4-fix): the set on the table and the incoming set, each slide(f) (0 on the table,
// 1 off it by its depth: the old to the south, the new from the north), show(bool), kanim(bool); its bowls of
// frankincense are meshes of the set (':bazichin', ':levonah') shown or hidden here while they are in the bowl-men's hands
// (a bowls(bool) on the movable is requested from world)
const SHULCHAN = 'heichal.shulchan.bread', INCOMING = 'heichal.shulchan.bread.incoming';

// minutes from the swap's start until the old bread is on the gold table (the plan's T.oldOnGoldEnd − T, measured:
// the retime's value before a Shabbat's plan exists) ⚙
const SWAP_SPAN = 4.4;

export default {
  id: 'shabbat-showbread',
  // inspect hooks (console-design §6.2): who each figure is and what it is doing; no behaviour change
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  // the kanim are out of the bread from Friday's pulling until after Shabbat (Menachot 11:6), so the module states the
  // Shulchan's bread every day (`always`); its figures only on Shabbat around the change
  always: true,
  lead: 8,          // the new bread is fetched from Beit HaMoked ~6 minutes before the change
  lag: 2,           // the eight hand over to shabbat-mishmar at the division's start (= the end of the bazichin)
  importance: 3,

  init(ctx, events, sim) {
    sim.setBounds([85, 270, 0], [252, 400, 30]);
    const state = {
      O: sim.pool({ name: 'outgoing', role: 'kohen', count: 4, seed: SEED_OUT, importance: 3 }),
      I: sim.pool({ name: 'incoming', role: 'kohen', count: 4, seed: SEED_IN, importance: 3 }),
      props: new FreeProps(ctx),
      fx: { steam: null, puff: null, made: false },
      plan: null, planGen: -1, out: {}, fnsO: [], fnsI: [],
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
      sh: { main: sim.door(SHULCHAN), inc: sim.door(INCOMING), c: {} },
    };
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    // the swap's listed window is the change itself: from its start until the old bread is laid on the gold table in the
    // Ulam (Menachot 11:7); bread-warm carries the Ulam's part on (qa-r2 SIM-R2-6: the data's ten minutes left the Shulchan
    // bare for the last five). As minutes after the data's start; SWAP_SPAN until a Shabbat's plan is built ⚙
    try { sim.schedule?.retime?.('showbread-swap', (t0) => [t0, t0 + (state.swapSpan ?? SWAP_SPAN)]); } catch (e) { console.warn('[sim] showbread-swap retime failed', e); }
    // the bazichin's row is listed while its two men are at the incense pile and on the ramp: the staged end (lib/watch.js
    // lastNear over their scripts), not the data's window (gate-sim-data)
    state.ends = { v: null, key: '' };
    state.rt = stagedRetime(sim, ['bazichin'], () => (state.ends.key === `${ctx.time?.dateString}|${sim.generation}` ? state.ends.v : null));
    stagedEnds(ctx, sim, state);
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const B = plan(ctx, sim, state);
    shulchan(ctx, state, B, t);
    if (!B) { state.props.hideAll(); fxSet(state, 0, 0); return; }
    runScripts(ctx, state.O, B.swapO, t, state.out, state.fnsO);
    runScripts(ctx, state.I, B.swapI, t, state.out, state.fnsI);
    state.props.update(t);
    effects(ctx, state, B, t);
    cues(ctx, state, sim, B);
  },

  release(ctx, state) { state.props.hideAll(); fxSet(state, 0, 0); shulchanSet(ctx, state, DEFAULTS); },

  debug(s) {
    const B = s.plan, f = s.fmt;
    if (!B) return 'no plan (not Shabbat)';
    const T = B.t;
    return `bread out ${f(T.bringLeave)} · on marble ${f(T.newOnMarble)} · lift ${f(T.lift)} · slide ${f(T.slide[0])} · on gold ${f(T.oldOnGold)} · touch ${f(T.touch)} · bowls ${f(T.takeBaz[0])} → pour ${f(T.pour[0])} · props ${s.props.shown}/${s.props.count}${B.warn.length ? `\n   ⚠ ${B.warn.slice(0, 4).join(' · ')}` : ''}`;
  },
};

function plan(ctx, sim, state) {
  if (state.planGen === sim.generation) return state.plan;
  state.planGen = sim.generation;
  const B = breadPlan(ctx, sim);
  state.plan = B;
  state.props.setPlan(B ? B.items.swap : []);
  if (B) {
    const T = B.t;
    const span = T.oldOnGoldEnd - B.T;
    if (Number.isFinite(span) && Math.abs(span - (state.swapSpan ?? -1)) > 1e-6) {
      state.swapSpan = span;
      const ev = sim.event('showbread-swap');
      if (ev) ctx.schedule?.resolveEvent?.(ev);
    }
    stagedEnds(ctx, sim, state);
    state.cue = {
      bring: wrap(T.bringLeave + 2.2), in: wrap(B.T + 0.55), slide: wrap(T.slide[0] + 0.1), gold: wrap(T.oldOnGold + 0.05),
      warm: wrap(Math.max(T.touch, B.warm[0] + 0.5)), baz: wrap(Math.max(T.takeBaz[0] + 0.1, B.baz[0] + 0.5)), burn: wrap(T.pour[0]),
      steam: [wrap(T.oldOnGold), wrap(B.div[0])], puff: wrap(T.pour[0]),
    };
  }
  return B;
}

/** the aggadah's warmth over the gold table; the frankincense's smoke at the pile (fx smoke columns, made lazily) */
function effects(ctx, state, B, t) {
  const c = state.cue;
  if (!c) return;
  let steam = 0;
  if (aggadahOn(ctx) && within(t, c.steam[0], c.steam[1])) {
    const u = wrap(t - c.steam[0]), L = wrap(c.steam[1] - c.steam[0]);
    steam = STEAM_MAX * smooth(0, 0.6, u) * (1 - smooth(L - 0.6, L, u));
  }
  let puff = 0;
  const d = wrap(t - c.puff);
  if (d < 6) puff = smooth(0, 0.25, d) * (1 - smooth(1.2, 6, d));
  if ((steam > 0 || puff > 0) && !state.fx.made) makeFx(ctx, state, B);
  fxSet(state, steam, puff);
}

function makeFx(ctx, state, B) {
  state.fx.made = true;
  const sc = ctx.fx?.smokeColumn;
  if (typeof sc !== 'function') return;
  try {
    const g = B.at.gold;
    // a faint breath of warmth from the loaves (aggadah layer only — "shown subtly or not at all"): a short, thin wisp
    // close over the bread; the higher tiers draw more puffs (render/fx INCENSE_PUFFS 10/18/26/34), so the density per
    // puff falls with the tier to keep the sum as faint as on low ⚙
    const puffs = [10, 18, 26, 34][clamp(ctx.quality?.detail ?? 1, 0, 3)] || 18;
    state.fx.steam = sc({ pos: [g[0], g[1], g[2] + 0.22], height: 0.35, width: 0.22, density: (0.06 * 10) / puffs, kind: 'incense', rise: 0.18 });
    state.fx.steam?.setIntensity(0);
    const p = B.at.pile;
    // the frankincense on the coals: a thicker white column, straight up (Avot 5:5)
    state.fx.puff = sc({ pos: [p[0], p[1], p[2] + 0.6], height: 14, width: 0.7, density: 0.55, kind: 'incense' });
    state.fx.puff?.setIntensity(0);
  } catch (e) { console.warn('[sim] g6 smoke failed', e); }
}

function fxSet(state, steam, puff) {
  const f = state.fx;
  if (f.steam && Math.abs((f.steamV ?? -1) - steam) > 0.01) { f.steamV = steam; f.steam.setIntensity(clamp(steam)); }
  if (f.puff && Math.abs((f.puffV ?? -1) - puff) > 0.01) { f.puffV = puff; f.puff.setIntensity(clamp(puff)); }
}

function cues(ctx, state, sim, B) {
  const c = state.cue, at = B.at;
  say(ctx, state, sim, 'sb-bring', c.bring, at.marble, TEXT.bring, { id: 'showbread-bring', dur: 7, range: 60 });
  say(ctx, state, sim, 'sb-in', c.in, at.shulchan, TEXT.in, { id: 'showbread-swap', dur: 9, range: NEAR });
  say(ctx, state, sim, 'sb-slide', c.slide, at.shulchan, TEXT.slide, { id: 'showbread-slide', dur: 8, range: NEAR });
  say(ctx, state, sim, 'sb-gold', c.gold, at.gold, TEXT.gold, { id: 'showbread-gold', dur: 8, range: NEAR });
  if (aggadahOn(ctx)) say(ctx, state, sim, 'sb-warm', c.warm, at.gold, TEXT.warm, { id: 'bread-warm', dur: 10, range: NEAR });
  say(ctx, state, sim, 'sb-baz', c.baz, at.gold, TEXT.baz, { id: 'bazichin', dur: 7, range: 60 });
  say(ctx, state, sim, 'sb-burn', c.burn, at.pile, TEXT.burn, { id: 'bazichin-burn', dur: 8, range: 50 });
}

// ------------------------------------------------------------------------------------------------ the Shulchan's bread
const DEFAULTS = { mainF: 0, mainShown: true, mainBowls: true, incF: 1, incShown: false, incBowls: true, kanim: true };
const _sh = { ...DEFAULTS };
/**
 * The bread on the Shulchan at t: the set on the table until the change; the old bowls off it in the outgoing bowl-men's
 * hands (B.t.bowlsOff); "these draw and those lay down, the handbreadth of this one beside the handbreadth of that"
 * (Menachot 11:7): the old set slid off to the south as the incoming is slid on from the north over the slide, the old
 * hidden once it is in the stack-men's hands; the new bowls set on (bowlsSet); then the sets swapped back (they are
 * identical, so nothing visible changes). The kanim out from Friday after the afternoon service until after Shabbat
 * (Menachot 11:6) ⚙ the hours. A pure function of (t, date).
 */
function shulchan(ctx, state, B, t) {
  const S = _sh;
  Object.assign(S, DEFAULTS);
  const dt = ctx.time?.dayType, z = ctx.time?.zmanim || {};
  if (dt === 'friday' && t >= (z.minchaKetana ?? 900) + 60) S.kanim = false;
  if (dt === 'shabbat' && t < (z.tzeit ?? 1080) + 30) S.kanim = false;
  const T = B?.t;
  if (T && Number.isFinite(T.swapBack)) {
    const s0 = T.slide[0], s1 = T.slide[1], back = T.swapBack;
    if (within(t, T.bowlsOff, back)) S.mainBowls = false;
    if (within(t, s0, back)) {
      const k = within(t, s0, s1) ? clamp(since(t, s0) / (span(s0, s1) || 1)) : 1;
      S.mainF = k; S.mainShown = k < 1;
      S.incShown = true; S.incF = 1 - k; S.incBowls = within(t, T.bowlsSet, back);
      S.kanim = false;
    }
  }
  shulchanSet(ctx, state, S);
}

/** apply a state to the two bread sets (slides through the door contract; show / kanim / bowls change-cached) */
function shulchanSet(ctx, state, S) {
  const h = state.sh;
  if (!h?.main?.exists) return;
  h.main.set(S.mainF);
  if (h.inc?.exists) h.inc.set(S.incF);
  const c = h.c;
  const ud = (id) => ctx.movables?.get?.(id)?.userData;
  if (c.mainShown !== S.mainShown) { c.mainShown = S.mainShown; ud(SHULCHAN)?.show?.(S.mainShown); }
  if (c.incShown !== S.incShown) { c.incShown = S.incShown; ud(INCOMING)?.show?.(S.incShown); }
  if (c.kanim !== S.kanim) { c.kanim = S.kanim; ud(SHULCHAN)?.kanim?.(S.kanim); }
  if (c.mainBowls !== S.mainBowls) { c.mainBowls = S.mainBowls; bowls(ctx, SHULCHAN, S.mainBowls); }
  if (c.incBowls !== S.incBowls) { c.incBowls = S.incBowls; bowls(ctx, INCOMING, S.incBowls); }
}

/** a bread set's bowls of frankincense (its ':bazichin' and ':levonah' meshes) shown or hidden */
function bowls(ctx, id, on) {
  const node = ctx.movables?.get?.(id);
  if (!node) return;
  for (const m of node.children) if (/:(bazichin|levonah)$/.test(m.name)) m.visible = on;
}

/** the bazichin's staged end (init: stagedRetime) */
function stagedEnds(ctx, sim, state) {
  const B = state.plan;
  if (!B || !state.ends) return;
  const ev = sim.event('bazichin');
  const at = ev && sim.schedule?.positionOf?.(ev);
  if (!at || !Number.isFinite(ev.t0)) return;
  const w = ev.tPlan || [ev.t0, ev.t1];
  state.ends.v = { bazichin: lastNear((S, t, o) => evalScript(S, t, o, null), [...B.swapO, ...B.swapI].filter(Boolean), w[0], w[1], siteOf(at)) };
  state.ends.key = `${ctx.time?.dateString}|${sim.generation}`;
  state.rt.apply();
}

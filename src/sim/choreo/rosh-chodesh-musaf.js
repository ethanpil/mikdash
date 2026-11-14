// The musaf of Rosh Chodesh (Bamidbar 28:11–15, 10:10; Rambam Temidin uMusafin 6:3, 6:10, 7:1–2; Yoma 2:5–7;
// Zevachim 5:3–4; Sukkah 5:5, 54b–55a; docs/decisions/rosh-chodesh.md).
//
// Events served (choreo 'rosh-chodesh-musaf', occasion 'rosh-chodesh' — only on the 1st of a month): rc-musaf-slaughter,
// rc-goat-chatat, rc-musaf-flaying, rc-musaf-limbs. The plan is g7/plan.js (a pure function of the date), cached per
// runtime generation in g7/concert.js, which also publishes the musaf's concert (rcConcert) for libation-song: its
// Levites, trumpeters, segan and pourer stage rc-musaf-song, as they stage the Shabbat musaf's (that module claims
// 'rc-musaf-song'). On Shabbat Rosh Chodesh the Shabbat musaf goes first and pours its wine without song (shabbat-musaf).
//
// Figures: the eleven animals are pooled at boot (warmed: the bull's programs compile behind the loader); the 123 kohanim
// (Yoma 2:5–7: 24 + 24 + 11 + 7 × 8, three slaughterers, three receivers, the goat's two) are pooled on the first Rosh
// Chodesh date only and spawned as each first shows — an ordinary day's boot does not carry them. Props: one actor per
// name and concurrent use, reused from procession to procession (the walk holds a bull's 18 parts at most).
import { runScripts, phaseFn, evalScript, setLead, within } from './g2/lib.js';
import { rcPlan } from './g7/concert.js';
import { PROCESSIONS } from './g7/plan.js';
import { say } from './g6/common.js';
import { roshChodesh as inspectHooks } from './describe/rosh-chodesh.js';

const NEAR = 45;
/** crew key (g7/plan.js CREWS) → pool name, seed; the animals' pools */
export const CREW_POOLS = {
  teams: ['rc-slaughterers', 0x7c00], bullA: ['rc-bull-a', 0x7c01], bullB: ['rc-bull-b', 0x7c02],
  ram: ['rc-ram-crew', 0x7c03], lambs: ['rc-lamb-crews', 0x7c04], goat: ['rc-goat-crew', 0x7c05],
};
const ANIMAL_POOLS = { bulls: ['bull', 2, 0x7c10], ram: ['ram', 1, 0x7c11], lambs: ['lamb', 7, 0x7c12], goat: ['goat', 1, 0x7c13] };
const SIZES = { teams: 6, bullA: 24, bullB: 24, ram: 11, lambs: 56, goat: 2 };

const TEXT = {
  brought: { en: 'Rosh Chodesh: "On your new moons you shall offer an olah — two young bulls, one ram, seven yearling lambs" (Bamidbar 28:11), and a goat for a chatat, brought in by Sha\'ar HaKorban', he: 'וּבְרָאשֵׁי חׇדְשֵׁיכֶם תַּקְרִיבוּ עֹלָה לַה׳ פָּרִים בְּנֵי בָקָר שְׁנַיִם וְאַיִל אֶחָד כְּבָשִׂים בְּנֵי שָׁנָה שִׁבְעָה' },
  cut: { en: 'The musaf of Rosh Chodesh after the morning tamid; every olah done as the tamid — slaughtered in the north (Rambam TuM 7:1–2)', he: 'מַקְרִיבִין מוּסַף רֹאשׁ חֹדֶשׁ אַחַר תָּמִיד שֶׁל שַׁחַר' },
  blood: { en: 'An olah: its blood thrown at the north-east and south-west corners — two gifts that are four (Zevachim 5:4)', he: 'שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע' },
  goat: { en: 'The goat of Rosh Chodesh: "he went up the ramp, turned to the sovev and came to the south-east horn" — four gifts on the four horns, the rest on the southern yesod (Zevachim 5:3)', he: 'עָלָה בַכֶּבֶשׁ וּפָנָה לַסּוֹבֵב וּבָא לוֹ לְקֶרֶן דְּרוֹמִית מִזְרָחִית' },
  laid: { en: 'The limbs of Rosh Chodesh are laid on the altar above, between horn and horn, on the walk of the kohanim\'s feet — "to make it known that it is Rosh Chodesh"; they are salted there (Rambam TuM 6:3)', he: 'וְשֶׁל רָאשֵׁי חֳדָשִׁים נוֹתְנִין עַל הַמִּזְבֵּחַ מִלְּמַעְלָה בֵּין קֶרֶן לְקֶרֶן... כְּדֵי לְפַרְסְמוֹ שֶׁהוּא רֹאשׁ חֹדֶשׁ' },
  bull: { en: 'A bull is offered by twenty-four: the head by one, the right leg by two, the tail by two, the left leg by two, the breast by one, the neck by three, the forelegs by two, the flanks by two, the innards, the flour and the wine by three each (Yoma 2:7)', he: 'פַּר קָרֵב בְּעֶשְׂרִים וְאַרְבָּעָה' },
  ram: { en: 'A ram is offered by eleven: the flesh by five, the innards, the flour and the wine by two each (Yoma 2:6)', he: 'אַיִל קָרֵב בְּאַחַד עָשָׂר' },
  fats: { en: 'The goat\'s fats on the fire after the olot\'s limbs — "the limbs of an olah before the fats of a chatat" (Zevachim 10:2); its meat is eaten in the court by male kohanim until midnight (Zevachim 5:3)', he: 'אֵבְרֵי עוֹלָה קוֹדְמִין לְאֵמוּרֵי חַטָּאת' },
  song: { en: 'The musaf\'s wine is poured: nine more blasts, and the Levites sing (Sukkah 5:5; Rambam TuM 6:5). Which psalm they sang on Rosh Chodesh is not recorded — the model sings Psalm 81, "Blow the shofar at the new moon", as a stand-in', he: 'וּבְרָאשֵׁי חׇדְשֵׁיכֶם וּתְקַעְתֶּם בַּחֲצֹצְרֹת עַל עֹלֹתֵיכֶם' },
};

export default {
  id: 'rosh-chodesh-musaf',
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  lead: 9,          // the animals come up the flight of Sha'ar HaKorban ~8½ minutes before the window
  lag: 4,
  importance: 3,

  init(ctx, events, sim) {
    sim.setBounds([150, 262, 0], [252, 426, 30]);
    const animals = {};
    for (const [k, [kind, n, seed]] of Object.entries(ANIMAL_POOLS)) animals[k] = sim.pool({ name: `rc-${k}`, animal: kind, count: n, seed, importance: 3 });
    return { animals, crews: null, props: new SharedProps(ctx), planGen: -1, plan: null, out: {}, fns: {}, afns: {}, fmt: (x) => ctx.time?.format?.(x) ?? '--' };
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) { state.props.hideAll(); return; }
    const S = state, out = S.out;
    for (const [k, list] of Object.entries(P.scripts)) runScripts(ctx, S.crews[k], list, t, out, S.fns[k] || (S.fns[k] = []));
    for (const [k, list] of Object.entries(P.animals)) {
      const pool = S.animals[k];
      const fns = S.afns[k] || (S.afns[k] = []);
      for (let i = 0; i < list.length; i++) {
        const sl = pool.slot(i);
        if (!fns[i]) fns[i] = phaseFn(ctx, sl);
        evalScript(list[i], t, out, fns[i]);
        if (out.vis) {
          if (out.zx) sl.place(out.X, out.Y, out.Z); else sl.placeNear(out.X, out.Y, out.Z);
          sl.heading(out.h).pose(out.pose, out.ph).show();
        }
        let lead = null;
        for (const [a, b, pk, si, crew, cs] of P.leads) if (pk === k && si === i && within(t, a, b)) lead = S.crews[crew].slot(cs);
        setLead(sl, out.vis ? lead : null);
      }
    }
    S.props.update(t);
    cues(ctx, S, sim, P);
  },

  release(ctx, state) { state.props.hideAll(); },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan (not Rosh Chodesh)';
    const T = P.t;
    return `cuts ${Object.entries(T.cut).map(([k, v]) => `${k} ${f(v)}`).join(' · ')}\n   rows ${PROCESSIONS.map((k) => `${k} ${f(T.row[k])}`).join(' · ')}\n   goat blood ${f(T.blood.goat?.[0])} · fats ${f(T.goatFats)} · jug ${f(T.wineLaid)} → pick ${f(T.pickW)} · props ${s.props.shown}/${s.props.count}${P.warn.length ? `\n   ⚠ ${P.warn.slice(0, 4).join(' · ')}` : ''}`;
  },
};

/** the plan for the date (rebuilt on a new generation); the crews' pools on the first Rosh Chodesh date */
function plan(ctx, sim, state) {
  if (state.planGen === sim.generation) return state.plan;
  state.planGen = sim.generation;
  const P = rcPlan(ctx, sim);
  state.plan = P;
  if (P && !state.crews) {
    state.crews = {};
    for (const [k, [name, seed]] of Object.entries(CREW_POOLS)) state.crews[k] = sim.pool({ name, role: 'kohen', count: SIZES[k], seed, importance: k === 'teams' ? 3 : 2 });
  }
  state.props.setPlan(P ? P.items : []);
  if (!P) return null;
  const T = P.t, at = P.at;
  const first = (o) => Math.min(...Object.values(o).filter(Number.isFinite));
  state.cue = {
    brought: P.M0 - 8.0, cut: T.cut.bullA + 0.05, blood: T.blood.bullA?.[0], goat: T.blood.goat?.[0],
    laid: P.procs[0]?.top?.[1], ram: P.procs.find((p) => p.key === 'ram')?.top?.[0], bull: P.procs.find((p) => p.key === 'bullA')?.top?.[0],
    fats: T.goatFats, song: T.tPour + 0.05, bleats: first(T.cut),
  };
  void at;
  return P;
}

function cues(ctx, S, sim, P) {
  const c = S.cue, at = P.at, w = (x) => ((x % 1440) + 1440) % 1440;
  say(ctx, S, sim, 'rc-brought', w(c.brought), at.gate, TEXT.brought, { id: 'rc-brought', dur: 10, range: 70, sound: ['sheep', null, { kind: 'ram' }] });
  for (const [k, tc] of Object.entries(P.t.cut)) say(ctx, S, sim, `rc-bleat-${k}`, w(tc - 0.3), at.rings, null, { sound: ['sheep', null, { kind: k === 'ram' ? 'ram' : 'lamb' }] });
  say(ctx, S, sim, 'rc-cut', w(c.cut), at.rings, TEXT.cut, { id: 'rc-slaughter', dur: 9, range: NEAR });
  if (Number.isFinite(c.blood)) say(ctx, S, sim, 'rc-blood', w(c.blood), at.ne, TEXT.blood, { id: 'rc-blood', dur: 7, range: NEAR });
  if (Number.isFinite(c.goat)) say(ctx, S, sim, 'rc-goat', w(c.goat), at.horns, TEXT.goat, { id: 'rc-goat', dur: 10, range: 60 });
  if (Number.isFinite(c.laid)) say(ctx, S, sim, 'rc-laid', w(c.laid), at.walk, TEXT.laid, { id: 'rc-laid', dur: 10, range: 70 });
  if (Number.isFinite(c.ram)) say(ctx, S, sim, 'rc-ram', w(c.ram), at.ramp, TEXT.ram, { id: 'rc-ram', dur: 8, range: 60 });
  if (Number.isFinite(c.bull)) say(ctx, S, sim, 'rc-bull', w(c.bull), at.ramp, TEXT.bull, { id: 'rc-bull', dur: 11, range: 70 });
  if (Number.isFinite(c.fats)) say(ctx, S, sim, 'rc-fats', w(c.fats), at.walk, TEXT.fats, { id: 'rc-fats', dur: 9, range: 60 });
  // the song itself is libation-song's (its audio heads each section); this names what is sung and why
  if (Number.isFinite(c.song)) say(ctx, S, sim, 'rc-song', w(c.song), at.duchan, TEXT.song, { id: 'rc-song', dur: 12, range: 140 });
}

/**
 * Free props sharing actors (people.spawnProp): items { name, show: [t0, t1], keys: [{ t, X, Y, Z, h }] } are packed per
 * name onto as few actors as their windows allow (first fit), so the walk's limbs of ten processions need a bull's
 * worth of actors, not 150. update(t) shows each actor's item of the moment.
 */
class SharedProps {
  constructor(ctx) { this.ctx = ctx; this.byName = new Map(); this.slots = []; }
  _actor(name, i) {
    let list = this.byName.get(name);
    if (!list) { list = []; this.byName.set(name, list); }
    while (list.length <= i) {
      let a = null;
      try { a = this.ctx.people?.spawnProp?.(name, { seed: 0x7c40 + list.length }) || null; } catch { a = null; }
      a?.setVisible(false);
      list.push({ a, vis: false, X: NaN, Y: NaN, Z: NaN, h: NaN, items: [] });
    }
    return list[i];
  }
  setPlan(items) {
    for (const list of this.byName.values()) for (const s of list) { s.items = []; this._vis(s, false); }
    const span = (it) => (((it.show[1] - it.show[0]) % 1440) + 1440) % 1440;
    const sorted = [...items].sort((a, b) => a.show[0] - b.show[0]);
    for (const it of sorted) {
      let i = 0;
      for (;; i++) {
        const s = this._actor(it.name, i);
        // free when none of its items overlaps this one (cyclic windows)
        if (!s.items.some((o) => within(it.show[0], o.show[0], o.show[1]) || within(o.show[0], it.show[0], it.show[1]))) { s.items.push(it); break; }
      }
      void span;
    }
    this.slots = [...this.byName.values()].flat();
  }
  update(t) {
    for (const s of this.slots) {
      if (!s.a) continue;
      let on = null;
      for (const it of s.items) if (within(t, it.show[0], it.show[1])) { on = it; break; }
      if (on) { const k = on.keys[0]; this._place(s, k); }
      this._vis(s, !!on);
    }
  }
  hideAll() { for (const s of this.slots) this._vis(s, false); }
  _vis(s, on) { if (s.a && s.vis !== on) { s.vis = on; s.a.setVisible(on); } }
  _place(s, k) {
    if (!(Math.abs(s.X - k.X) <= 1e-4 && Math.abs(s.Y - k.Y) <= 1e-4 && Math.abs(s.Z - k.Z) <= 1e-4)) { s.X = k.X; s.Y = k.Y; s.Z = k.Z; s.a.setSite(k.X, k.Y, k.Z); }
    if (!(Math.abs(s.h - k.h) <= 1e-4)) { s.h = k.h; s.a.setHeading(k.h); }
  }
  get count() { return this.slots.length; }
  get shown() { let n = 0; for (const s of this.slots) if (s.vis) n++; return n; }
}

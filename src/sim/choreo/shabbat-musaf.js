// Shabbat musaf (Bamidbar 28:9–10; Yoma 33a; Sukkah 5:5; Shekalim 8:8; Rosh HaShanah 31a; Middot 1:5;
// Rambam Temidin uMusafin 4:9; report §27.3, §33.1, §33.6).
//
// Event served (choreo 'shabbat-musaf'): after the tamid's libation two yearling lambs, an olah, with their flour and
// wine. The outgoing watch offers them, and "whoever won a task at the morning tamid does it for the two musaf lambs"
// (TuM 4:9): the crew is the morning's (the same pool seed as tamid-morning's crew, so the same faces), the limbs and
// the flour go up with the morning's fourth-lottery men, and the wine with the man who took the morning's wine up (G3's
// brother 12). The lambs come up the flight of Sha'ar HaKorban (Middot 1:5), led by two Levites ⚙, just before the
// window, so they stand at the rings with the crew from its start; slaughter at two rings of the second row, both bloods
// by the same receiver, flaying at two dwarf pillars,
// the parts on the lower half of the ramp on its west side (Shekalim 8:8), salted, up onto the great pile, then the
// flour mixed with oil; the wine at the south-west horn. The plan is g6/musaf.js (pure function of the date).
//
// The song (RH 31a: Ha'azinu in six sections, הזי"ו ל"ך, one each Shabbat) with nine blasts (Sukkah 5:5) is the
// libation concert of Tamid 7:3. Its Levites, boys, segan and Ben Arza belong to libation-song: this module PUBLISHES
// the moment of the pour and the concert timeline (ctx.__g6musaf, and state.song) for it to stage them. Until
// libation-song claims the musaf song (its default export's `claims` includes 'shabbat-musaf-song'), this module stages
// the two trumpeters (on the table of the fats, then beside Ben Arza) and plays the concert through ctx.audio.libation,
// with the Psalm 92 melody standing in for Ha'azinu (requested from audio) and its own caption naming the section.
import { runScripts, FreeProps, setLead, phaseFn, evalScript, within, wrap } from './g2/lib.js';
import { SEEDS } from './g2/tamid.js';
import { musafPlan, MC_N, UP_N, POURER_SEED, PSALM_STAND_IN } from './g6/musaf.js';
import { g6places, say, HAAZINU } from './g6/common.js';
import { crossed, cueAt } from '../lib/cue.js';

const NEAR = 45;
const SEED_LEV = 0x6d6c, SEED_LAMB = 0x6d6d, SEED_TR = 0x6d74;

const TEXT = {
  brought: { en: 'Shabbat musaf: two yearling lambs without blemish (Bamidbar 28:9), brought in through Sha\'ar HaKorban (Middot 1:5) — by which, the commentators say, the most-holy offerings came in — wait at the rings', he: 'וּבְיוֹם הַשַּׁבָּת שְׁנֵי כְבָשִׂים בְּנֵי שָׁנָה תְּמִימִם' },
  cut: { en: 'The morning\'s winners serve the musaf too — whoever won a task at the tamid does it for the two musaf lambs: the same slaughterer, the same receiver of the blood (Rambam TuM 4:9)', he: 'כָּל שֶׁזָּכָה בַּעֲבוֹדָה מֵעֲבוֹדַת הַתָּמִיד שֶׁל שַׁחַר הוּא זוֹכֶה בָּהּ בִּשְׁנֵי כִּבְשֵׂי מוּסָף' },
  blood: { en: 'An olah: its blood is thrown at the north-east corner and at the south-west, below the red line — two gifts that are four (Zevachim 5:4)', he: 'שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע' },
  laid: { en: 'The musaf limbs are laid on the lower half of the ramp, on its west side, and salted (Shekalim 8:8)', he: 'וְשֶׁל מוּסָפִין נִתָּנִין מֵחֲצִי כֶבֶשׁ וּלְמַטָּה בַּמַּעֲרָב' },
  up: { en: 'Up onto the fire: the limbs of the two lambs, then their fine flour mixed with oil — two tenths of an ephah (Bamidbar 28:9)', he: 'וּשְׁנֵי עֶשְׂרֹנִים סֹלֶת מִנְחָה בְּלוּלָה בַשֶּׁמֶן' },
};

export default {
  id: 'shabbat-musaf',
  lead: 3.5,        // the Levites bring the lambs up the flight ~2¾ minutes before the window
  lag: 3,
  importance: 2,

  init(ctx, events, sim) {
    const G = g6places(ctx);
    sim.setBounds([85, 265, 0], [256, 425, 30]);
    const state = {
      G,
      // the morning tamid's crew (tamid-morning: pool 'crew', seed SEEDS.morning) and fourth-lottery men (SEEDS.up)
      crew: sim.pool({ name: 'crew', role: 'kohen', count: MC_N, seed: SEEDS.morning, importance: 3 }),
      up: sim.pool({ name: 'limbs-up', role: 'kohen', count: UP_N, seed: SEEDS.up, importance: 2 }),
      // the man who takes the wine up and pours — only when libation-song does not stage the pour
      pourer: sim.pool({ name: 'pourer', role: 'kohen', count: 1, seed: POURER_SEED, importance: 2 }),
      levites: sim.pool({ name: 'levites', role: 'levi', count: 2, seed: SEED_LEV, importance: 2 }),
      lambs: sim.pool({ name: 'lambs', animal: 'lamb', count: 2, seed: SEED_LAMB, importance: 2 }),
      trumpeters: sim.pool({ name: 'trumpeters', role: 'kohen', count: 2, seed: SEED_TR, importance: 2, prop: 'trumpet' }),
      props: new FreeProps(ctx),
      plan: null, planGen: -1, out: {}, fns: { crew: [], up: [], lev: [], lamb: [], tr: [], pr: [] }, pourers: [null],
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) { state.props.hideAll(); return; }
    const S = state, out = S.out;
    runScripts(ctx, S.crew, P.crew, t, out, S.fns.crew);
    runScripts(ctx, S.up, P.up, t, out, S.fns.up);
    runScripts(ctx, S.levites, P.levites, t, out, S.fns.lev);
    for (let i = 0; i < 2; i++) {
      const sl = S.lambs.slot(i);
      if (!S.fns.lamb[i]) S.fns.lamb[i] = phaseFn(ctx, sl);
      evalScript(P.lambs[i], t, out, S.fns.lamb[i]);
      if (out.vis) {
        if (out.zx) sl.place(out.X, out.Y, out.Z); else sl.placeNear(out.X, out.Y, out.Z);
        sl.heading(out.h).pose(out.pose, out.ph).show();
      }
      let lead = null;
      for (const [a, b, li, who] of P.leads) {
        if (li !== i || !within(t, a, b)) continue;
        lead = who === 'levite' ? S.levites.slot(i) : who === 'S' ? S.crew.slot(0) : S.crew.slot(2);
      }
      setLead(sl, out.vis ? lead : null);
    }
    S.props.update(t);
    const song = P.song;
    if (!songClaimed(sim)) {
      S.pourers[0] = P.pourer;
      runScripts(ctx, S.pourer, S.pourers, t, out, S.fns.pr);
      runScripts(ctx, S.trumpeters, song.trumpeters, t, out, S.fns.tr);
      if (crossed(S, song.L0)) {
        cueAt(S, `musaf-concert:${Math.round(song.L0 * 10)}`, song.L0, () => {
          try { ctx.audio?.libation?.({ psalm: PSALM_STAND_IN, caption: false, trumpets: song.table, benArza: song.benArza, walk: song.walkS }); } catch (e) { console.warn('[sim] musaf libation audio failed', e); }
        });
      }
    }
    cues(ctx, S, sim, P);
  },

  release(ctx, state) { state.props.hideAll(); },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan (not Shabbat)';
    const T = P.t;
    return `lambs up ${f(P.M0)} · cut ${f(T.cut[0])}/${f(T.cut[1])} · hung ${f(T.hang0)}/${f(T.hang1)} · laid ${f(T.laid[0][0])}/${f(T.laid[1][0])} · up ${f(T.pick[0][0])} · flour ${f(T.tossF)} · pour ${f(T.pour)} · Ha'azinu §${P.song.section + 1} · song ${P.claimed ? 'libation-song' : 'own trumpeters + audio'} · props ${s.props.shown}/${s.props.count}${P.warn.length ? `\n   ⚠ ${P.warn.slice(0, 4).join(' · ')}` : ''}`;
  },
};

/** libation-song stages the musaf's concert itself (its export's claims include 'shabbat-musaf-song') */
function songClaimed(sim) {
  const e = sim.schedule?.runtime?.choreo?.('libation-song');
  const c = e?.mod?.claims;
  return !!(e && !e.failed && Array.isArray(c) && c.includes('shabbat-musaf-song'));
}

function plan(ctx, sim, state) {
  // rebuilt per date, and when libation-song's claim on the concert is first seen (the runtime is not yet on ctx at init)
  const claimed = songClaimed(sim);
  if (state.planGen === sim.generation && state.claimed === claimed) return state.plan;
  state.claimed = claimed;
  state.planGen = sim.generation;
  const M = musafPlan(ctx, sim, claimed);
  state.plan = M;
  state.props.setPlan(M ? M.items : []);
  ctx.__g6musaf = M ? M.concert : null;      // also on ctx for debugging; libation-song should call musafConcert(ctx, sim)
  if (!M) return null;
  const T = M.t;
  state.cue = {
    brought: wrap(M.M0 + 0.55), cut: wrap(T.cut[0] + 0.05), cutB: wrap(T.cut[1] + 0.05), blood: wrap(T.throw[0]), bleat: [wrap(T.bind[0] + 0.3), wrap(T.bind[1] + 0.3)],
    laid: wrap(T.laid[0][0] + 0.1), up: wrap(T.toss[0][0]), song: wrap(T.pour + 0.05),
  };
  return M;
}

function cues(ctx, S, sim, P) {
  const c = S.cue, at = P.at, T = P.t;
  say(ctx, S, sim, 'mu-brought', c.brought, at.ringA, TEXT.brought, { id: 'musaf-brought', dur: 9, range: 60, sound: ['sheep', null, { kind: 'lamb' }] });
  for (let i = 0; i < 2; i++) say(ctx, S, sim, `mu-bleat${i}`, c.bleat[i], i ? P.at.ringB : P.at.ringA, null, { sound: ['sheep', null, { kind: 'lamb' }] });
  say(ctx, S, sim, 'mu-cut', c.cut, at.ringA, TEXT.cut, { id: 'musaf-slaughter', dur: 9, range: NEAR });
  say(ctx, S, sim, 'mu-blood', c.blood, at.altar, TEXT.blood, { id: 'musaf-blood', dur: 7, range: NEAR });
  say(ctx, S, sim, 'mu-laid', c.laid, at.ramp, TEXT.laid, { id: 'musaf-laid', dur: 7, range: NEAR });
  say(ctx, S, sim, 'mu-up', c.up, at.altar, TEXT.up, { id: 'musaf-up', dur: 7, range: 60 });
  // the pour's caption names this Shabbat's section (libation-song leaves it to this module: captions.pour = false)
  {
    const h = HAAZINU[P.song.section];
    say(ctx, S, sim, 'mu-song', c.song, at.sw, {
      en: `The musaf wine is poured; nine more blasts for the musaf (Sukkah 5:5), and the Levites sing this Shabbat's section of Ha'azinu — ${h.en}, section ${P.song.section + 1} of six (Rosh HaShanah 31a)`,
      he: `שִׁירַת הַאֲזִינוּ — ${h.he}`,
    }, { id: 'musaf-song', dur: 10, range: 120 });
  }
  void T;
}

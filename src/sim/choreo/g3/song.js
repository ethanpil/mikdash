// Group G3 — the wine libation and the Levites' song (Tamid 5:6, 7:3–4; Sukkah 4:9; Arachin 2:3–6; Shekalim 5:1):
//   the Levites run to the duchan at the magrefah (morning) or walk there before the afternoon song; twelve on its one-amah
//   step facing the altar — nine kinnorot, two nevalim and Ben Arza with the single cymbal — and four Levite boys on the
//   pavement below, their heads at the men's feet; the pourer takes the wine from the lower ramp (where the nine laid it,
//   Tamid 4:3) up the ramp and left to the SW horn's cups; the segan on the corner with the sudarin; two kohanim on the
//   table of the fats blow teki'ah-teru'ah-teki'ah, then come and stand at Ben Arza's right and left; he bends to pour,
//   the segan waves, Ben Arza strikes, the Levites sing; at each section a teki'ah and the people's prostration.
// On Shabbat morning the Kohen Gadol pours the tamid's wine (tamid-morning.js brings him round the altar to the SW corner;
// the wine is given him — Tamid 7:3), and the Levites stay on the duchan for the musaf's song, whose pour and timeline
// shabbat-musaf publishes (g6/musaf.js musafConcert; this module claims 'shabbat-musaf-song').
// Every concert is the audio's parts (plan.js libTimeline) spread over its song's window (plan.js spreadTimeline): the
// first set, the walk to Ben Arza and the pour fall in the libation's window (afternoon: early in the song's), and the
// three sections, with the second and third sets between them, fill the song's window. Between the tamid's song and the
// musaf's on Shabbat the Levites go back to their chambers. On Shabbat the musaf's concert sings this week's section of
// Ha'azinu and the afternoon's the Shirah of the week (Rosh HaShanah 31a), each timed by the audio's clock for that song
// (songTimeline).
import { Script } from './script.js';
import { add, cue, SRV } from './day.js';
import { spreadTimeline, psalmOfDay, CUE_LEAD, MAX_WALK_S, D_SET, GAP_S } from './plan.js';
import { musafConcert } from '../g6/musaf.js';
import { concertClock } from '../g6/common.js';
import { rand } from '../../lib/core.js';

const SEED = 0x6735;
// the Levites on the duchan's one-amah step: offsets (amot) from Ben Arza along Y and instruments ⚙. North of the
// axis the line leaves a gap at dy ≈ 5–8 (Y ≈ 335.5–338.5), where the kohanim's way from Lishkat Pinchas crosses the
// duchan (courts-daily.js PINCHAS_WAY)
export const LEVITES = [
  { dy: 0, inst: 'cymbal' },                                                     // Ben Arza (Shekalim 5:1)
  { dy: -3.2, inst: 'kinnor' }, { dy: 3.2, inst: 'kinnor' }, { dy: -4.8, inst: 'nevel' }, { dy: 4.8, inst: 'nevel' },
  { dy: -6.4, inst: 'kinnor' }, { dy: 8.6, inst: 'kinnor' }, { dy: -8.0, inst: 'kinnor' }, { dy: 10.2, inst: 'kinnor' },
  { dy: -9.6, inst: 'kinnor' }, { dy: 11.8, inst: 'kinnor' }, { dy: 13.4, inst: 'kinnor' },
];
const BOYS = [-2.4, 2.4, -5.6, 9.4];
const TRUMP_DY = [1.6, -1.6];          // at his right and at his left (he faces west: right = north)
const sec = (s) => s / 60;
// the libation's cymbal (the pour) this far into the libation window, at most (min) ⚙
const POUR_IN_LIBATION = 2.6;

export const TEXT = {
  wine: { en: '"They gave him wine to pour": the wine is carried up the ramp and to the left, to the silver cups at the south-western horn; the segan takes his place at the corner with the sudarin (Tamid 7:3; Sukkah 4:9)', he: 'נָתְנוּ לוֹ יַיִן לְנַסֵּךְ' },
  set0: { en: 'On the table of the fats two kohanim with silver trumpets blow teki\'ah, teru\'ah, teki\'ah; then they come and stand by Ben Arza, one at his right and one at his left (Tamid 7:3)', he: 'תָּקְעוּ וְהֵרִיעוּ וְתָקְעוּ' },
  pour: { en: 'He bends to pour; the segan waves the sudarin; Ben Arza strikes the cymbal — and the Levites begin the song (Tamid 7:3)', he: 'שָׁחָה לְנַסֵּךְ, וְהֵנִיף הַסְּגָן בַּסּוּדָרִין, וְהִקִּישׁ בֶּן אַרְזָא בַּצֶּלְצָל' },
  section: { en: 'A section of the song ends: teki\'ah — and the people fall on their faces. "For every section a teki\'ah, for every teki\'ah a prostration" (Tamid 7:3)', he: 'הִגִּיעוּ לְפֶרֶק, תָּקְעוּ, וְהִשְׁתַּחֲווּ הָעָם' },
  levites: { en: 'At the sound of the magrefah the Levites run to the duchan: "his brothers the Levites are going in to sing" (Tamid 5:6)', he: 'בֶּן לֵוִי … יוֹדֵעַ שֶׁאֶחָיו הַלְוִיִּם נִכְנָסִים לְדַבֵּר בַּשִּׁיר' },
  song: (psalm) => ({
    en: `On the duchan the Levites sing the song of the day, Psalm ${psalm}, to kinnorot and nevalim, the Levite boys' voices below; at each section a teki'ah, and the people fall on their faces (Tamid 7:3–4; Arachin 2:3–6)`,
    he: 'שִׁיר שֶׁל יוֹם — הַלְוִיִּם עַל הַדּוּכָן',
  }),
  // T: the afternoon's songTimeline (its title and verses are the audio's: what is sung)
  shirah: (T) => ({
    en: `At the afternoon tamid of Shabbat the Levites sing ${T.title.en} (${T.range}): one each Shabbat in turn — "Az yashir", "Mi chamocha", "Az yashir Yisrael" (Rosh HaShanah 31a)`,
    he: `שִׁירָה בְּשַׁבָּת בַּמִּנְחָה — ${T.title.he}`,
  }),
};
/**
 * Shabbat afternoon (Rosh HaShanah 31a): the Song at the Sea in two parts, "Az yashir" and "Mi chamocha", and the Song of
 * the Well, one each Shabbat in a three-week cycle (the cycle's start is not given ⚙: counted from Shabbat 2026-01-03,
 * as shabbat-musaf counts Ha'azinu's six) — the week passed to the audio, which sings that song (src/audio/songs.js
 * SHIRAH_CYCLE).
 */
export function shirahOfDate(ctx) {
  const d = ctx.time?.date;
  if (!d) return 0;
  const days = Math.round((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(2026, 0, 3)) / 86400000);
  return ((Math.floor(days / 7) % 3) + 3) % 3;
}

/**
 * A Shabbat song's concert (song: { song: 'haazinu' | 'shirah', week } or { song: id }) on the audio's own clock for
 * that song (g6/common.js concertClock = ctx.audio.libationTimeline), spread over its window as plan.js spreadTimeline
 * spreads the psalm of the day: the first set, the walk and the pour as the audio plays them, then the three sung parts
 * over [the pour, tEnd], the second and third sets between them, each part's 'choir' loop carrying it on (loop). The
 * same shape as spreadTimeline's, plus song (the audio's id), title and range; psalm is the song's id too, since
 * ketoret-morning cues the parts with { psalm: T.psalm } and the audio resolves a song named there (src/audio/index.js
 * concert().music). null without the audio's clock.
 */
function songTimeline(ctx, L0, song, style, walkS, tEnd) {
  const A = concertClock(ctx, { ...song, style, walk: walkS });
  if (!A) return null;
  const sg = A.style === 'sg1612';
  const m = (s) => s / 60, at = (s) => L0 + s / 60;
  // within a set (s from its first blast): the blowing's end, the people's prostration, the cymbal (sg1612), the part
  const S0 = A.sets[0], S1 = A.sets[1];
  const blowIn = S0.blasts[S0.blasts.length - 1].t1 - S0.t0, prostIn = A.prostrations[0].t0 - S0.t0;
  const cymIn = sg ? A.cymbals[1] - S1.t0 : NaN, partIn = A.sections[1].t0 - S1.t0;
  // each part's buffer and its last note (s from its start)
  const D = A.sections.map((x) => x.t1 - x.t0), E = A.sections.map((x) => x.singEnd - x.t0);
  const c0 = at(A.sections[0].t0), gap = m(GAP_S);
  const sing = Math.max(m(Math.max(...D)), (tEnd - c0 - 2 * (gap + m(partIn))) / 3);
  const sets = [at(S0.t0)], blow = [at(blowIn)], prost = [at(prostIn)], cym = [at(A.pour)], ch = [], loop = [];
  let c = c0;
  for (let s = 0; s < 3; s++) {
    const last = c + sing - m(D[s] - E[s]);
    ch.push([c, last, c + sing]);
    const l0 = c + m(D[s] - 5);
    loop.push(last - l0 > m(10) ? [l0, last] : null);
    if (s === 2) break;
    const st = c + sing + gap;
    sets.push(st); blow.push(st + m(blowIn)); prost.push(st + m(prostIn));
    if (sg) cym.push(st + m(cymIn));
    c = st + m(partIn);
  }
  const v0 = A.sections[0].verses[0].ref.en, v1 = A.sections[2].verses[A.sections[2].verses.length - 1].ref.en;
  const range = v1.split(':')[0] === v0.split(':')[0] ? `${v0}–${v1.split(':')[1]}` : `${v0}–${v1}`;
  return {
    L0, psalm: A.song, song: A.song, title: A.title, range, style: A.style, walkS,
    sets, blow, cym, ch, prost, loop, end: ch[2][2], perf: ch[2][2], cym0S: A.pour, spread: true,
  };
}

/** the trumpeters' way from the east side of the table round the ramp's foot to their place by Ben Arza ⚙ */
function trumpWay(P, j) {
  const d = P.duchan, y = P.heichal.axisY + TRUMP_DY[j];
  return [...P.way.footToDuchan, [d.box.min[0] + 0.25, P.heichal.axisY + (j ? -1.0 : 1.0), P.AZ], [d.X, y, d.Z1]];
}
const pathLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L * 0.48; };

/** the trumpeters' walk (s) as the audio is told it: their longer way at a hurried 1.5 m/s, within the audio's 4–25 s */
export function walkSeconds(P) {
  const A = P.altar;
  const L = Math.max(pathLen([A.marbleStand(1), ...trumpWay(P, 0)]), pathLen([A.marbleStand(0), ...trumpWay(P, 1)]));
  return Math.min(MAX_WALK_S, Math.max(4, L / 1.5));
}

/**
 * One session on the duchan: the Levites and the boys come (o.arriveLevites; o.run at the magrefah), bow with the
 * people's prostrations, play and sing each concert's sections, and go back to their chambers at o.leave. Each concert
 * c: { key, T (libTimeline shape), trumpeters: [{ from } | { pool, i, t0 }], wine: same + { at?, pourAt? }, segan:
 * { handover } | { t0 }, pickJug, kg: { t } | null, audio: { song?, caption? }, captions: { pour: bool } }.
 */
export function buildSession(ctx, P, W, D, o) {
  const d = P.duchan, ax = P.heichal.axisY;
  const concerts = o.concerts;
  // the concerts' own parts first (their prostrations go into D.prost, which the Levites bow with)
  for (const c of concerts) concertKohanim(ctx, P, W, D, c);
  const ascent = (side) => {
    const m = P.music[side];
    const a = side === 'N' ? P.music.ascentN : P.music.ascentS;
    const sgn = side === 'N' ? 1 : -1;
    return [m.out, ...a, [261.2, ax + 2.8 * sgn, P.EY], [255.5, ax + 2.3 * sgn, P.EY], [249.0, ax + 2.7 * sgn, P.EY]];
  };
  // their bows: the people's prostrations while they stand there, except those of the sets (they stand ready) ⚙
  const setProst = new Set(concerts.flatMap((c) => c.T.prost.map((p) => Math.round((p - sec(0.8)) * 1e4))));
  const bowsAt = D.prost.filter((p) => p > o.arriveLevites + 0.6 && p < o.leave && !setProst.has(Math.round(p * 1e4))).sort((a, b) => a - b);
  const levite = (i, dy, pool, boy) => {
    const side = dy >= 0 ? 'N' : 'S';
    const m = P.music[side];
    const react = 0.01 + 0.05 * rand(SEED, boy ? 'br' : 'lr', i, o.key);
    const inst = boy ? null : LEVITES[i].inst;
    // a lyre hangs in the left hand; played, the clip holds it in the left (people draws the right-hand prop there)
    const props = inst === 'cymbal' ? ['cymbal', 'cymbal'] : inst ? [null, inst] : [null, null];
    const playing = inst && inst !== 'cymbal' ? [inst, null] : props;
    const S = Script.from(o.arriveLevites - 0.3, m.inside, 90, `${boy ? 'boy' : 'levi'}${i}`, props);
    S.hide(o.arriveLevites + react, m.inside, 90);
    const y = ax + dy;
    S.walk([...ascent(side), [d.boysX - (boy ? 0 : 0.6), y, P.EY]], { speed: o.run ? (boy ? 2.6 : 2.8) : (boy ? 1.0 : 1.05), pose: o.run ? 'run' : 'walk' });
    if (!boy) S.shift([d.X, y, d.Z1], 0.035, { heading: 270 });
    S.act(0.05, { pose: 'stand', heading: 270 });
    let tc = S.now();
    const until = (t, opts) => { if (t > tc) { S.until(t, opts); tc = t; } };
    const seed = SEED + i + (boy ? 50 : 0);
    const events = [...bowsAt.map((p) => ({ t: p, bow: true })), ...concerts.map((c) => ({ t: c.T.sets[0] - 0.02, c }))].sort((a, b) => a.t - b.t);
    for (const ev of events) {
      if (ev.bow) {
        if (ev.t < tc) continue;
        until(ev.t + 0.02, { pose: 'stand', heading: 270, sway: 3, seed, props });
        S.act(0.14, { pose: 'bow', phase: [0, 1], heading: 270 });
        tc = S.now();
        continue;
      }
      const T = ev.c.T;
      for (let s = 0; s < 3; s++) {
        const [c0, c1] = T.ch[s];
        const cym = T.cym[s] !== undefined && (s === 0 || T.style === 'sg1612') ? T.cym[s] : NaN;
        if (inst === 'cymbal' && cym === cym) {
          until(cym - sec(1), { pose: 'stand', heading: 270, sway: 2, seed: seed + 7 * s });
          S.act(sec(2), { pose: 'play_cymbal', phase: [0, 1], heading: 270 });
          tc = S.now();
        } else until(c0, { pose: 'stand', heading: 270, sway: 2, seed: seed + 7 * s, props });
        if (inst === 'kinnor' || inst === 'nevel') until(c1, { pose: inst === 'nevel' ? 'play_nevel' : 'play_kinnor', phase: { cycle: inst === 'nevel' ? 2.0 : 1.67, off: rand(SEED, 'pl', i) }, heading: 270, props: playing });
        else until(c1, { pose: 'sing', heading: 270 });
      }
    }
    until(o.leave + 0.03 * i + (boy ? 0.15 : 0), { pose: 'stand', heading: 270, sway: 4, seed: seed + 90, props });
    if (!boy) S.shift([d.boysX - 0.6, y, P.EY], 0.035, { heading: 90 });
    S.walk([...[...ascent(side)].reverse(), m.inside], { speed: 1.0 });
    S.hide(S.now() + 0.01);
    add(D, pool, i, S);
    return S;
  };
  for (let i = 0; i < LEVITES.length; i++) levite(i, LEVITES[i].dy, 'levites', false);
  for (let i = 0; i < BOYS.length; i++) levite(i, BOYS[i], 'boys', true);
  if (o.run) cue(D, `${o.key}-levites`, o.arriveLevites + 0.12, { caption: TEXT.levites, at: [d.X, ax, d.Z1], range: 45, id: 'levites-run' });
}

/** one concert's kohanim — trumpeters, the pourer (or the Kohen Gadol), the segan — and its sound and captions */
function concertKohanim(ctx, P, W, D, c) {
  const A = P.altar, R = P.ramp, AZ = P.AZ, d = P.duchan, ax = P.heichal.axisY;
  const T = c.T, cym0 = T.cym[0], tEnd = T.end;
  const pourAt = A.pourStand;
  // after the pour the pourer and the segan go down; the trumpeters stay by Ben Arza for the later sets ⚙
  const pourDone = cym0 + 0.75;
  // "he bent to pour" (Tamid 7:3 שחה לנסך): people's pour_low — down over the cups, the jug tipped over its lip as the
  // cymbal sounds (its 0.32–0.5 tilt ends at cym0), held while the wine runs, righted, up ⚙ seconds
  const bendAndPour = (S) => {
    S.act(sec(2.2), { pose: 'pour_low', phase: [0, 0.3], heading: 180 });
    S.act(sec(1.8), { pose: 'pour_low', phase: [0.3, 0.5], heading: 180 });
    S.act(sec(1.4), { pose: 'pour_low', phase: [0.5, 0.62], heading: 180 });
    S.act(sec(2.0), { pose: 'pour_low', phase: [0.62, 1], heading: 180 });
  };

  // ---- the trumpeters: wait by the tables, up on the table of the fats, the first set, to Ben Arza, the other two sets
  c.trumpeters.forEach((tp, j) => {
    const S = tp.from || Script.from(tp.t0, P.doors.gazit, 90, `trump${j}`);
    if (!tp.from) S.walk([...P.way.gazitToApron, P.way.apronS, P.way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ]], { speed: 1.15 });
    const waitAt = [203.6, A.marble.min[1] + 1.6 - 1.2 * j, AZ];
    S.walk([[203.4, 290.0, AZ], waitAt], { speed: 1.0, props: ['trumpet', null] });
    S.until(T.L0 - 0.32 - 0.03 * j, { pose: 'stand', heading: 75, sway: 8, seed: SEED + 200 + j });
    const st = A.marbleStand(1 - j), top = A.marbleTop(1 - j);
    S.walk([[203.6, j ? A.marble.min[1] - 0.9 : A.marble.max[1] + 0.9, AZ], st], { speed: 0.9 });
    S.shift(top, 0.05, { heading: 20 });
    S.until(T.sets[0], { pose: 'stand', heading: 20 });
    S.until(T.blow[0], { pose: 'blow_trumpet', heading: 20 });
    S.until(T.sets[0] + sec(D_SET - 0.2), { pose: 'stand', heading: 20 });
    S.shift(st, 0.04, { heading: 90 });
    S.walkBy(cym0 - sec(1.5), trumpWay(P, j), { pose: 'walk' });
    S.act(0.03, { pose: 'stand', heading: 270 });
    for (let s = 1; s < 3; s++) {
      S.until(T.sets[s], { pose: 'stand', heading: 270, sway: 2, seed: SEED + 210 + j });
      S.until(T.blow[s], { pose: 'blow_trumpet', heading: 270 });
    }
    S.until(tEnd + 0.9 + 0.1 * j, { pose: 'stand', heading: 270, sway: 3, seed: SEED + 220 + j });
    // out over the duchan into Ezrat Kohanim and north round the altar to the Gazit ⚙
    S.walk([[d.box.min[0] - 1.0, ax + TRUMP_DY[j] + 0.4, AZ], [P.way.eastLine, 345, AZ], [P.way.eastLine, 372.5, AZ], [181, 384.5, AZ], [156, 383.6, AZ], [99.2, 377, AZ], P.doors.gazit], { speed: 1.15 });
    S.hide(S.now() + 0.01);
    if (!tp.from) add(D, tp.pool, tp.i, S);
  });

  // ---- the wine and the pourer (weekday, the musaf) / the man who brings it to the Kohen Gadol (Shabbat's tamid)
  const wineOnRamp = c.wine.at || [R.box.min[0] + 1.875, R.halfY - 1.9 - 1.33 * 8, R.kevZ(R.halfY - 1.9 - 1.33 * 8)];
  const wineWait = [R.box.min[0] - 0.85, wineOnRamp[1] + 0.2, AZ];
  const down = (S, x, speed) => S.walk([[A.wk.W + 1.9, A.wk.S + 0.2, A.ZT], [x, R.head + 0.8, A.ZT], [x, R.head - 0.8, A.ZT], [x, R.foot + 0.6, AZ], [x, R.foot - 1.4, AZ],
    [207.5, 275.4, AZ], [203.4, 279.5, AZ], [196.0, 279.0, AZ], ...[...P.way.medichinOut].reverse(), P.doors.medichin], { speed });
  {
    const w = c.wine;
    const S = w.from || Script.from(w.t0, w.fromDoor === 'medichin' ? P.doors.medichin : P.doors.gazit, w.fromDoor === 'medichin' ? 0 : 90, 'wine');
    if (!w.from) {
      if (w.fromDoor === 'medichin') S.walk([...P.way.medichinOut.slice(0, 2), [196.0, 279.0, AZ], [203.4, 279.5, AZ]], { speed: 1.1 });
      else S.walk([...P.way.gazitToApron, P.way.apronS, P.way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 279.5, AZ]], { speed: 1.15 });
    } else S.walk([[203.4, 279.5, AZ]], { speed: 1.0 });
    S.walk([wineWait], { speed: 1.0 });
    S.until(c.pickJug - 0.1, { pose: 'stand', heading: 90, sway: 8, seed: SEED + 230 });
    S.act(0.06, { pose: 'bow', phase: [0, 0.42], heading: 85 });
    S.act(0.06, { pose: 'bow', phase: [0.7, 1], props: ['wine_jug', null] });
    S.shift([R.west, wineOnRamp[1] + 0.4, R.kevZ(wineOnRamp[1] + 0.4)], 0.05, { heading: 0 });
    // up the ramp and to the left, to the SW horn — he will come back on his heel (Zevachim 6:3; Sukkah 4:9)
    S.walk([[R.west, R.head - 0.8, A.ZT], [R.west, R.head + 0.8, A.ZT], [A.wk.W + 1.9, A.wk.S + 0.2, A.ZT], c.kg ? A.wineAt : pourAt], { speed: 0.9 });
    if (c.kg) {
      S.until(T.L0 - 0.3, { pose: 'stand', face: A.pourAt, sway: 4, seed: SEED + 231 });
      S.act(0.07, { pose: 'carry', face: A.pourAt });
      S.act(0.05, { pose: 'stand', face: A.pourAt, props: null });
      S.shift([A.wineAt[0] + 0.3, A.wineAt[1] - 0.45, A.ZT], 0.05);
      S.until(pourDone + 0.1, { pose: 'stand', face: A.cupsC, sway: 3, seed: SEED + 232 });
    } else {
      S.until(cym0 - sec(4), { pose: 'stand', heading: 180, sway: 2, seed: SEED + 233 });
      bendAndPour(S);
      S.until(pourDone, { pose: 'stand', heading: 180, sway: 3, seed: SEED + 234 });
    }
    down(S, R.west, 1.0);
    S.hide(S.now() + 0.01);
    if (!w.from) add(D, w.pool, w.i, S);
  }
  // ---- the segan with the sudarin
  {
    const sg = c.segan;
    let S;
    if (sg.handover) {
      S = Script.from(sg.handover.t, sg.handover.at, sg.handover.h, 'segan-lib', ['sudar', 'sudar']);
      S.walk([A.seganAt], { speed: 0.5 });
    } else {
      S = Script.from(sg.t0, P.doors.gazit, 90, 'segan-lib');
      S.walk([...P.way.gazitToApron, P.way.apronS, P.way.sw, [200.4, 302.0, AZ], [203.4, 296.0, AZ], [203.4, 279.5, AZ], [207.5, 275.6, AZ], [R.west + 1.0, R.foot - 1.5, AZ]], { speed: 1.15 });
      S.until(c.pickJug + 0.08, { pose: 'stand', heading: 0, sway: 6, seed: SEED + 240 });
      S.walk([[R.west + 1.0, R.foot + 0.6, AZ], [R.west + 1.0, R.head - 0.8, A.ZT], [R.west + 1.0, R.head + 0.8, A.ZT], [A.wk.W + 2.6, A.wk.S + 0.9, A.ZT], A.seganAt], { speed: 0.88, props: ['sudar', 'sudar'] });
    }
    S.until(cym0 - sec(3.2), { pose: 'stand', heading: 70, sway: 3, seed: SEED + 241, props: ['sudar', 'sudar'] });
    // "the segan waved the sudarin" (Tamid 7:3): one swung high from over his right shoulder, out to the side and back,
    // the other hanging from his left hand (people's wave_sudar) — Ben Arza strikes the cymbal on the signal ⚙ swings
    S.act(sec(8.3), { pose: 'wave_sudar', phase: { cycle: 1 / 0.6 }, heading: 70, props: ['sudar', 'sudar'] });
    S.until(pourDone + 0.05, { pose: 'stand', heading: 70, sway: 3, seed: SEED + 242 });
    S.walk([[A.wk.W + 2.6, A.wk.S + 0.9, A.ZT], [R.west + 1.0, R.head + 0.8, A.ZT], [R.west + 1.0, R.head - 0.8, A.ZT], [R.west + 1.0, R.foot + 0.6, AZ], [R.west + 1.0, R.foot - 1.4, AZ],
      [207.5, 275.6, AZ], [203.4, 279.5, AZ], [203.4, 296.0, AZ], [200.4, 302.0, AZ], P.way.sw, P.way.apronS, P.way.apronN, ...[...P.way.gazitToApron].reverse().slice(1), P.doors.gazit], { speed: 1.05 });
    S.hide(S.now() + 0.01);
    add(D, 'segan', 0, S);
  }
  // ---- Shabbat: the Kohen Gadol pours the tamid's wine (Tamid 7:3 "they gave him wine to pour")
  if (c.kg) {
    const S = Script.from(c.kg.t, A.pourAt, 225, 'kg-lib');
    S.until(T.L0 - 0.25, { pose: 'stand', heading: 225, sway: 3, seed: SEED + 250 });
    S.act(0.05, { pose: 'stand', heading: 200, props: ['wine_jug', null] });
    S.walk([pourAt], { speed: 0.5 });
    S.until(cym0 - sec(4), { pose: 'stand', heading: 180, sway: 2, seed: SEED + 251 });
    bendAndPour(S);
    S.until(pourDone + 0.2, { pose: 'stand', heading: 180, sway: 3, seed: SEED + 252 });
    S.walk([[A.wk.W + 1.9, A.wk.S + 0.2, A.ZT], [R.west, R.head + 0.8, A.ZT], [R.west, R.head - 0.8, A.ZT], [R.west, R.foot + 0.6, AZ], [R.west, R.foot - 1.4, AZ],
      [207.5, 275.4, AZ], [203.4, 279.5, AZ], [203.4, 296.0, AZ], [200.4, 302.0, AZ], P.way.sw, P.way.apronS, P.way.apronN, ...[...P.way.gazitToApron].reverse().slice(1), P.doors.gazit], { speed: 0.8 });
    S.hide(S.now() + 0.01);
    add(D, 'kg', 0, S);
  }

  // ---- the people's prostrations, the audio and the captions
  for (let s = 0; s < 3; s++) D.prost.push(T.prost[s] - sec(0.8));
  D.libs.push({ key: c.key, T, audio: c.audio || {}, at: { table: [205.5, 286, 20.5], benArza: [d.X, ax, d.Z1 + 3], duchan: [d.X, ax, d.Z1 + 3], ...(c.at || {}) } });
  cue(D, `${c.key}-wine`, c.pickJug + 0.03, { caption: TEXT.wine, at: [R.west, R.foot + 4, AZ], range: 70, id: 'libation-wine' });
  cue(D, `${c.key}-set0`, T.sets[0] + 0.004, { caption: TEXT.set0, at: [205.5, 286, 17.5], range: 70, id: 'libation-trumpets' });
  if (c.captions?.pour !== false) cue(D, `${c.key}-pour`, cym0, { caption: TEXT.pour, at: A.pourAt, range: 140, id: 'libation-pour' });
  for (let s = 1; s < 3; s++) cue(D, `${c.key}-sect${s}`, T.sets[s] + 0.004, { caption: TEXT.section, at: [d.X, ax, d.Z1], range: 140, id: 'song-section' });
}

/**
 * The musaf's concert as shabbat-musaf publishes it (g6/musaf.js: its first set, walk and pour on the audio's clock for
 * this Shabbat's section of Ha'azinu, mc.song), spread to a minute before the musaf's window closes; null when not
 * Shabbat.
 */
function musafTimeline(ctx, sim) {
  let mc = null;
  try { mc = musafConcert(ctx, sim); } catch (e) { console.warn('[sim:g3] musaf concert unavailable', e); }
  if (!mc || !Number.isFinite(mc.L0) || !mc.song) return null;
  const t1 = Number.isFinite(mc.t1) && mc.t1 > mc.L0 + 4 ? mc.t1 : mc.L0 + 8;
  const T = songTimeline(ctx, mc.L0, { song: mc.song }, 'mishnah', mc.walkS, Math.min(t1 - 1.0, mc.L0 + 14));
  return T ? { mc, T } : null;
}

/** the morning's (with Shabbat's musaf) and the afternoon's sessions (W windows; m = the morning build's hand-overs) */
export function buildSongs(ctx, P, W, D, m, sim) {
  const style = ctx.settings?.get?.('musicStyle') === 'sg1612' ? 'sg1612' : 'mishnah';
  const walkS = walkSeconds(P);
  const cymOff = (D_SET - 0.2 + walkS) / 60;
  const sab = W.shabbat;
  const psalm = psalmOfDay(ctx);
  const du = P.duchan, ax = P.heichal.axisY;
  // morning: the first set, the walk and the pour in the libation's window; the three sections over the song's, the
  // last ending a minute before it closes, when the Levites go back to their chambers ⚙
  const cymAm = W.LB[0] + Math.min(POUR_IN_LIBATION, 0.65 * (W.LB[1] - W.LB[0]));
  const amT = spreadTimeline(cymAm - cymOff, psalm, style, walkS, W.SG[1] - 1.0);
  const sessions = [{
    key: 'am', arriveLevites: m.mg, run: true, leave: W.SG[1],
    concerts: [{
      key: 'am', T: amT,
      trumpeters: [{ from: m.after[10] }, { from: m.after[11] }],
      wine: { from: m.after[12] },
      segan: sab ? { handover: { t: W.LU[1], at: [P.altar.pourAt[0] + 1.2, P.altar.pourAt[1] + 0.3, P.altar.ZT], h: 225 } } : { t0: W.LB[0] - 2.6 },
      pickJug: W.LB[0] + CUE_LEAD,
      kg: sab ? { t: W.LU[1] } : null,
    }],
  }];
  cue(D, 'song-day', W.SG[0] + CUE_LEAD, { caption: TEXT.song(psalm), at: [du.X, ax, du.Z1], range: 140, id: 'song-day' });
  let musaf = null;
  if (sab && sim) {
    musaf = musafTimeline(ctx, sim);
    if (musaf && musaf.T.L0 > amT.end + 2) {
      const mc = musaf.mc;
      const mu = {
        key: 'musaf', T: musaf.T,
        trumpeters: [{ pool: 'servers', i: SRV.T1, t0: mc.L0 - 3.6 }, { pool: 'servers', i: SRV.T2, t0: mc.L0 - 3.5 }],
        wine: { pool: 'brothers', i: 12, t0: mc.wine.pick - 2.4, fromDoor: 'medichin', at: mc.wine.at },
        segan: { t0: mc.wine.pick - 2.8 },
        pickJug: mc.wine.pick,
        kg: null,
        // what is sung: this Shabbat's section of Ha'azinu, its verses captioned by the audio as it sings them
        audio: { song: musaf.T.song },
        at: { table: mc.table, benArza: mc.benArza, duchan: mc.benArza },
        captions: { pour: false },     // shabbat-musaf captions the pour with the Ha'azinu section
      };
      // the Levites go down to their chambers between the songs, unless the musaf's follows at once ⚙
      if (musaf.T.L0 - W.SG[1] > 8) sessions.push({ key: 'musaf', arriveLevites: musaf.T.L0 - 4.0, run: false, leave: musaf.T.end + 1.2, concerts: [mu] });
      else { sessions[0].concerts.push(mu); sessions[0].leave = Math.max(W.SG[1], musaf.T.end + 1.2); }
    } else musaf = null;
  }
  for (const o of sessions) buildSession(ctx, P, W, D, o);
  // afternoon: the first set 0.9 min into the event, the sections to its end; the Levites walk to the duchan during the
  // limbs ⚙. Shabbat: the Song at the Sea / of the Well of the week (Rosh HaShanah 31a), on the audio's clock for it
  const pmT = (sab && songTimeline(ctx, W.AS[0] + 0.9, { song: 'shirah', week: shirahOfDate(ctx) }, style, walkS, W.AS[1] - 0.8))
    || spreadTimeline(W.AS[0] + 0.9, psalm, style, walkS, W.AS[1] - 0.8);
  if (pmT.song) cue(D, 'song-shirah', W.AS[0] + CUE_LEAD, { caption: TEXT.shirah(pmT), at: [du.X, ax, du.Z1], range: 140, id: 'song-shirah' });
  buildSession(ctx, P, W, D, {
    key: 'pm', arriveLevites: W.AS[0] - 7.5, run: false, leave: W.AS[1],
    concerts: [{
      key: 'pm', T: pmT,
      trumpeters: [{ pool: 'servers', i: SRV.T1, t0: W.AS[0] - 3.4 }, { pool: 'servers', i: SRV.T2, t0: W.AS[0] - 3.3 }],
      wine: { pool: 'servers', i: SRV.W2, t0: W.AS[0] - 3.9 },
      segan: { t0: W.AS[0] - 3.6 },
      pickJug: W.AS[0] + CUE_LEAD,
      kg: null,
      ...(pmT.song ? { audio: { song: pmT.song } } : {}),
    }],
  });
  return { am: amT, pm: pmT, musaf: musaf?.T || null, amLeave: sessions[0].leave };
}

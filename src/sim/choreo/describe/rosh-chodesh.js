// Inspect hooks for rosh-chodesh-musaf (G7): who each figure of the Rosh Chodesh musaf is and what he does, by pool and
// slot (g7/plan.js CREWS and CARRY; the pools' names in rosh-chodesh-musaf.js CREW_POOLS). Texts follow Bamidbar
// 28:11–15, Yoma 2:5–7, Zevachim 5:3–4, Rambam TuM 6:3, 7:1–2.
import { describeWith } from './index.js';
import { CARRY } from '../g7/plan.js';

const EV = ['rc-musaf-slaughter', 'rc-goat-chatat', 'rc-musaf-flaying', 'rc-musaf-limbs'];
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
const partOf = (kind, i) => CARRY[kind]?.[i];
/** a carrier's own task as the Mishnah lists it (the part he carries, or the flour / the wine) */
function task(kind, i) {
  const c = partOf(kind, i);
  if (!c) return 'one of its kohanim';
  if (c.role === 'flour') return 'he carries its fine flour mixed with oil, thrown on the fire after the limbs';
  if (c.role === 'wine') return 'he carries its wine, poured at the south-west horn';
  if (c.role === 'innards') return 'he carries its innards';
  return `he carries its ${c.part}`;
}
const carrierDoing = (kind, what) => ({
  'rc-musaf-slaughter': (ctx, state, who) => (who.index % (kind === 'lamb' ? 8 : 99) === 0 ? `Leading ${what} in and holding it for the slaughter` : `Holding ${what} for the slaughter`),
  'rc-musaf-flaying': (ctx, state, who) => ((who.index % (kind === 'lamb' ? 8 : 99)) < (kind === 'bull' ? 2 : 1) ? `Flaying ${what} and cutting it into its parts` : `Coming for his part of ${what} as it is cut — then the row, as at the tamid`),
  'rc-musaf-limbs': (ctx, state, who) => {
    const c = partOf(kind, kind === 'lamb' ? who.index % 8 : who.index);
    if (c?.role === 'flour') return `Up the ramp with ${what}'s flour, to throw it on the fire after the limbs`;
    if (c?.role === 'wine') return `Up the west half of the ramp with ${what}'s wine, to pour it at the south-west horn`;
    return `In the file up the ramp with ${what}'s ${c?.part || 'parts'}, to lay them on the altar between the horns, salt them and throw them on the fire`;
  },
});
const lambOf = (who) => Math.floor(who.index / 8);

export const roshChodesh = describeWith({
  id: 'rosh-chodesh-musaf',
  pools: {
    'rc-slaughterers': {
      sub: (who) => (who.index % 2 ? 'R' : 'S'), events: EV,
      phrase: { S: 'one of the three kohanim slaughtering the musaf of Rosh Chodesh (how many at once is not recorded)', R: 'a kohen receiving the blood of the musaf in a vessel of service' },
      doing: {
        'rc-musaf-slaughter': { S: 'Slaughtering the musaf\'s animals at the rings, in the verse\'s order: the bulls, the ram, the lambs', R: 'Receiving the blood at the neck and throwing it at the north-east and south-west corners — two gifts that are four' },
        'rc-goat-chatat': { S: 'Slaughtering the goat of Rosh Chodesh, a chatat', R: 'Putting the goat\'s blood with his finger on the four horns, walking round the sovev from the south-east horn' },
        _: { S: 'At the musaf of Rosh Chodesh', R: 'At the musaf of Rosh Chodesh' },
      },
      why: { 'rc-goat-chatat': { en: 'The goats of Rosh Chodesh are the public\'s chatat: slaughtered in the north, their blood on the four horns from the sovev, the rest on the southern yesod.', sources: ['Zevachim 5:3'] } },
    },
    'rc-bull-a': {
      phrase: (ctx, state, who) => `one of the twenty-four kohanim who offer the first bull (Yoma 2:7) — ${task('bull', who.index)}`,
      doing: carrierDoing('bull', 'the first bull'),
    },
    'rc-bull-b': {
      phrase: (ctx, state, who) => `one of the twenty-four kohanim who offer the second bull (Yoma 2:7) — ${task('bull', who.index)}`,
      doing: carrierDoing('bull', 'the second bull'),
    },
    'rc-ram-crew': {
      phrase: (ctx, state, who) => `one of the eleven kohanim who offer the ram (Yoma 2:6) — ${task('ram', who.index)}`,
      doing: carrierDoing('ram', 'the ram'),
    },
    'rc-lamb-crews': {
      phrase: (ctx, state, who) => `one of the eight kohanim of the ${ORD[lambOf(who)]} lamb (as the tamid's nine, without the chavitin — Yoma 2:5) — ${task('lamb', who.index % 8)}`,
      doing: carrierDoing('lamb', 'his lamb'),
      key: (who) => `rosh-chodesh-musaf:rc-lamb-crews:${who.index}`,
    },
    'rc-goat-crew': {
      sub: (who) => (who.index ? 'H' : 'F'), events: EV,
      phrase: { F: 'the kohen who leads in the goat of Rosh Chodesh, flays it and takes its fats up to the fire', H: 'a kohen holding the goat for the slaughter' },
      doing: {
        'rc-musaf-slaughter': { F: 'Leading the goat in and holding it', H: 'Holding the goat for the slaughter' },
        'rc-goat-chatat': { F: 'Holding the goat; then he hangs it on a hook to be flayed', H: 'Holding the goat for the slaughter' },
        'rc-musaf-flaying': { F: 'Flaying the goat: its fats go to the altar, its meat to the kohanim', _: 'At the musaf' },
        'rc-musaf-limbs': { F: 'Carrying the goat\'s fats up to the fire, after the olot\'s limbs (Zevachim 10:2)', _: 'At the musaf' },
      },
    },
    'rc-bulls': {
      custom: (ctx, state, who) => ({
        doing: { en: who.index ? 'The second bull of the Rosh Chodesh musaf' : 'The first bull of the Rosh Chodesh musaf' },
        phrase: { en: 'a young bull, an olah of the musaf of Rosh Chodesh' }, eventId: 'rc-musaf-slaughter',
        why: { en: '"On your new moons you shall offer an olah: two young bulls, one ram, seven yearling lambs" — a bull with three tenths of fine flour and half a hin of wine.', sources: ['Bamidbar 28:11–14'] },
        subjectKey: `rosh-chodesh-musaf:rc-bulls:${who.index}`,
      }),
    },
    'rc-ram': {
      custom: () => ({
        doing: { en: 'The ram of the Rosh Chodesh musaf' }, phrase: { en: 'the ram, an olah of the musaf of Rosh Chodesh' }, eventId: 'rc-musaf-slaughter',
        why: { en: 'One ram, with two tenths of fine flour and a third of a hin of wine.', sources: ['Bamidbar 28:11–14'] }, subjectKey: 'rosh-chodesh-musaf:rc-ram:0',
      }),
    },
    'rc-lambs': {
      custom: (ctx, state, who) => ({
        doing: { en: `The ${ORD[who.index]} of the seven lambs of the Rosh Chodesh musaf` }, phrase: { en: 'a yearling lamb without blemish, an olah of the musaf of Rosh Chodesh' }, eventId: 'rc-musaf-slaughter',
        why: { en: 'Seven yearling lambs without blemish, each with a tenth of fine flour and a quarter of a hin of wine.', sources: ['Bamidbar 28:11–14'] }, subjectKey: `rosh-chodesh-musaf:rc-lambs:${who.index}`,
      }),
    },
    'rc-goat': {
      custom: () => ({
        doing: { en: 'The goat of Rosh Chodesh, a chatat' }, phrase: { en: 'a male goat, the public\'s chatat on Rosh Chodesh' }, eventId: 'rc-goat-chatat',
        why: { en: '"And one male goat as a chatat to the Lord": its blood on the four horns, its fats on the altar, its meat eaten by male kohanim in the court until midnight.', sources: ['Bamidbar 28:15', 'Zevachim 5:3'] },
        subjectKey: 'rosh-chodesh-musaf:rc-goat:0',
      }),
    },
  },
});

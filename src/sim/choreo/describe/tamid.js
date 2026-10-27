// The tamid crew's roles for the inspect hooks (tamid-morning, tamid-afternoon, shabbat-musaf, gazit-shema): the second
// lottery's thirteen tasks (Tamid 3:1; Yoma 2:3), the crew slots of g2/tamid.js (CREW: S 0, R 1, L 2–7, F 8, C 9, WN 10,
// LOGS 11–12), and what each does at each stage of the offering (Tamid 3:3–4:3, 7:3). Texts follow the Mishnah's words.
const PART = [
  'the head and the right hind leg', 'the two forelegs', 'the tail and the left hind leg', 'the chest and the neck', 'the two flanks',
  'the innards, in a dish with the lower legs on them',
];

/** the crew slot's task key: 'S' | 'R' | 'L0'…'L5' | 'F' | 'C' | 'WN' | 'LOG' */
export const crewRole = (i) => (i === 0 ? 'S' : i === 1 ? 'R' : i >= 2 && i <= 7 ? `L${i - 2}` : i === 8 ? 'F' : i === 9 ? 'C' : i === 10 ? 'WN' : 'LOG');
const part = (sub) => PART[+String(sub).slice(1)] || 'his part';

export const CREW_PHRASE = (lamb = 'the tamid') => ({
  S: `the kohen who won the slaughter of ${lamb} in the second lottery`,
  R: `the kohen who won the throwing of ${lamb}'s blood`,
  F: 'the kohen who won the fine flour', C: 'the kohen who won the chavitin', WN: 'the kohen who won the wine',
  LOG: 'one of the two who carry up the two logs of wood',
  _: (ctx, state, who, t, ev, sub) => (String(sub).startsWith('L') ? `the kohen who won ${part(sub)}` : `one of the kohanim of ${lamb}`),
});

const L = (fn) => (ctx, state, who, t, ev, sub) => (String(sub).startsWith('L') ? fn(part(sub), sub) : null);

/** doing texts by stage; corner: 'north-western' (morning) | 'north-eastern' (afternoon) */
export function crewDoing(corner) {
  const watered = {
    S: 'Bringing the knives from Beit HaChalifot, then drawing the lamb to the slaughterhouse',
    R: 'Taking a silver basin for the blood',
    _: L(() => 'At the watering of the lamb from the gold cup and its checking; then following it to the slaughterhouse'),
  };
  const slaughter = {
    S: `Slaughtering the lamb at the ${corner} corner, on the second ring — he stands on its east, facing west`,
    R: 'Receiving the blood in a silver basin as the lamb is slaughtered',
    _: L(() => 'Holding the lamb — not tied but bound, its head to the south and its face to the west'),
  };
  const blood = {
    R: 'Putting the blood on the altar: at the north-east corner and at the south-west, each throw on two sides; the rest poured on the southern yesod',
    S: 'By the slain lamb, waiting to hang and flay it',
    _: L(() => 'Waiting by the slaughterhouse for the flaying'),
  };
  const flaying = {
    S: 'Flaying the lamb on a hook of the dwarf pillars and cutting it in the Mishnah\'s order, giving each part to the one who won it',
    R: 'Taking the hide to be salted',
    L5: 'Receiving the innards and rinsing them on the marble tables between the pillars',
    F: 'Bringing the fine flour', C: 'Bringing the chavitin', WN: 'Bringing the wine',
    _: L((p) => `Receiving ${p} from the flayer; then standing in the row`),
  };
  const toRamp = {
    F: 'Carrying the fine flour to the ramp', C: 'Carrying the chavitin to the ramp', WN: 'Carrying the wine to the ramp',
    S: 'Going down to Lishkat HaGazit, to read the Shema', R: 'Going down to Lishkat HaGazit, to read the Shema',
    _: L((p) => `Carrying ${p} to the lower half of the ramp, on its west side, where they are salted`),
  };
  const up = {
    F: 'Carrying the fine flour up the ramp to the fire', C: 'Carrying the chavitin up the ramp to the fire', WN: 'Carrying the wine up for the libation',
    LOG: 'Carrying one of the two logs up the ramp to the great pile',
    _: L((p) => `Carrying ${p} up the east side of the ramp and throwing them on the great pile`),
  };
  return { watered, slaughter, blood, flaying, toRamp, up };
}

export const LAMB_TEXT = {
  bound: 'Bound — head to the south, face to the west — at the second ring',
  drink: 'Given water from a gold cup before the slaughter',
  led: 'Led on its rope — out of the lamb chamber to be watered, then drawn to the slaughterhouse',
  chamber: 'In the lamb chamber of Beit HaMoked, where no fewer than six inspected lambs are kept',
};
const BOUND = new Set(['bound', 'bound_tied', 'struggle']), LED = new Set(['walk_led', 'stand_led', 'stand_halter', 'lead', 'walk']);
/** a lamb's state by its pose: 'bound' | 'drink' | 'led' | 'chamber' (the chamber's lambs stand by while one is offered) */
export function lambState(pose) {
  const p = String(pose || '');
  return BOUND.has(p) ? 'bound' : p === 'drink' ? 'drink' : LED.has(p) ? 'led' : 'chamber';
}
/** a lamb's doing by its pose */
export const lambDoing = (pose) => ({ en: LAMB_TEXT[lambState(pose)] });
export const LAMB_WHY = { en: 'The tamid: two male lambs in their first year, one in the morning and one in the afternoon, every day; no fewer than six inspected lambs were kept in the lamb chamber.', sources: ['Bamidbar 28:3–4', 'Arachin 2:5', 'Tamid 3:3–4'] };

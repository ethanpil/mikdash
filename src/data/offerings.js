// The offerings of individuals — what an observer could watch, step by step, on an ordinary day in the late Second
// Temple (ARCHITECTURE.md §9–§10). Owner: offerings-data. Read by the sim (src/sim/choreo/private-offerings.js and
// friends) to stage the continuous stream of korbanot yachid between the two temidim, and the evening and night
// continuations; referenced from the events in schedule.js by their `offerings` lists.
//
// AUTHORITY: Zevachim ch. 5–6 and 9–11 (Mishnah; Bavli 53a–64b), Menachot 5–7, 9, 13, Kinnim 1:1, Nazir 6:7–9,
// Negaim 14, Keritot 1:7, 2:1, Bikkurim 1–3, Tamid 2:1, 4:1–3, Middot 2:5, 3:1–5, 5:2–3, Shekalim 5:1–5, 6:4–6,
// Yoma 2:5–7, Pesachim 58b–59b, Megillah 2:6, Temurah 2:1, and the Rambam (Ma'aseh HaKorbanot = MK, Temidin uMusafin =
// TuM, Pesulei HaMukdashin, Beit HaBechirah = BhB, Bikkurim). Texts not in ../sources were read on Sefaria.
// The report's numbers (§11, §65.1) are used where it has them.
//
// WHAT IS RECONSTRUCTION: the sources give the ORDER and the PLACES of the rites; they do not give minutes, how many
// people came on a given day, or where some things (the cooking of the most-holy meat, the baking of meal-offerings,
// the chest for bird money) stood. Every `minutes` value is a reconstruction (an informed range); every `frequency`
// is a reconstruction justified in OFFERING_RULES.frequency.basis; a step's `confidence` says what its PLACE and
// ACT rest on: 'explicit' (the source says so), 'derived' (follows from a stated rule), 'reconstruction'.
//
// SHAPES
//   STATIONS[id]      { zone, el?, at?: [X,Y,Z], f?: [fx,fy,fz] (fractions in el.box), note, confidence }
//   OFFERING_TYPES[id]{ id, names{en,he,translit}, category, form, animals|birds|meal, broughtBy, occasions, slaughter,
//                       semichah, blood, burned, eaten, hide, nesachim, steps[], frequency, lanes, sources, notes }
//     step            { id, label, actors: [{ role, count, pose, prop?, gesture?, note? }], at: stationId | [ids],
//                       props: [...], animals: [...], minutes: [lo, hi], attire?, sources: [...], confidence, note? }
//                     roles are ARCHITECTURE §10's; `pose`/`prop` are names ctx.people knows today; `gesture` names the
//                     specific motion wanted (leaning, waving, nipping…) where no pose exists yet (see ASSET_NEEDS).
//   OFFERING_RULES    day rules, night rules, attire, nesachim table, lanes, seasons, frequency { perDay (totals, sets
//                     included), sets, alone (each component's remainder), counting (how to draw a day without
//                     double-counting) }; a set's frequency.yields = components per set.
//   offeringWindows(dayType, zmanim, opts?) -> windows of the civil date (minutes, 0 ≤ t0 < t1 ≤ 1440).

// ======================================================================================== stations (site amot)
export const STATIONS = {
  'gate-korban': { zone: 'gate-korban', el: 'azarah.gate.korban', note: "Sha'ar HaKorban, middle gate of the north wall; the name only is in the Mishnah (Middot 1:5) — taken as the way the most-holy offerings came in (Report §7.3)", confidence: 'reconstruction' },
  'gate-bechorot': { zone: 'gate-bechorot', el: 'azarah.gate.bechorot', note: "Sha'ar HaBechorot, middle gate of the south wall; the name only (Middot 1:4) — taken as the firstlings' gate (Report §7.3)", confidence: 'reconstruction' },
  nikanor: { zone: 'nikanor', el: 'azarah.gate.nikanor', at: [257.5, 330.5, 13.5], note: "Sha'ar Nikanor: the metzora's, the yoledet's and the sotah's station (Negaim 14:8; Sotah 1:5)", confidence: 'explicit' },
  'kinnin-chest': { zone: 'ezrat-nashim', at: [285, 348, 6], note: "The chest marked “kinnin” for bird-pair money (Shekalim 6:5). Its place is not given; a yoledet who has immersed still may not pass into Ezrat Yisrael (Kelim 1:8) yet puts her money in it (Eruvin 32a), so the model sets it in Ezrat Nashim by the steps", confidence: 'reconstruction' },
  seals: { zone: 'beit-hamoked', at: [217, 409, 16], note: 'Yochanan ben Pinchas sells the seal, Achiyah gives the libations (Shekalim 5:4); the model\'s chamber of seals in Beit HaMoked (Tamid 3:3; Report §9.2)', confidence: 'reconstruction' },
  rings: { zone: 'slaughter-zone', el: 'altar.rings', note: '24 rings north of the altar; the tamid rings (2nd ring at the NW and NE) are kept clear at the temidim\'s hours (Tamid 4:1; Middot 3:5)', confidence: 'explicit' },
  tzafon: { zone: 'slaughter-zone', el: 'altar.tzafon', note: 'the halachic north, from the altar to the north wall (Zevachim 5:1; Rambam MK 5:2)', confidence: 'explicit' },
  nanasin: { zone: 'slaughter-zone', el: 'altar.nanasin', note: '8 dwarf pillars, cedar blocks, three rows of iron hooks; carcasses hung and flayed (Middot 3:5); flaying stations in params.flayingStations', confidence: 'explicit' },
  'marble-tables': { zone: 'slaughter-zone', el: 'altar.marble-tables', note: 'the 8 marble tables on which the innards are rinsed (Shekalim 6:4; Tamid 4:2)', confidence: 'explicit' },
  medichin: { zone: 'medichin', el: 'azarah.chamber.medichin', note: 'Lishkat HaMedichin: the innards of the offerings rinsed (Middot 5:3; Tamid 4:2 "the stomach in the rinsers\' chamber")', confidence: 'explicit' },
  melach: { zone: 'melach', el: 'azarah.chamber.melach', note: 'Lishkat HaMelach: salt for the offerings (Middot 5:3)', confidence: 'explicit' },
  parvah: { zone: 'parvah', el: 'azarah.chamber.parvah', note: 'Lishkat HaParvah: the hides of the offerings salted (Middot 5:3)', confidence: 'explicit' },
  'altar-ne': { zone: 'ezrat-kohanim', el: 'altar.keren.ne', at: [233.3, 337.8, 16], note: 'the NE corner from the pavement, below the red line: first of the "two that are four" (Tamid 4:1; Rambam MK 5:6)', confidence: 'explicit' },
  'altar-sw': { zone: 'bein-haulam-lamizbeach', el: 'altar.keren.sw', at: [200.7, 305.2, 16], note: 'the SW corner from the pavement, below the red line: second of the "two that are four"; bird chatat; hagashah (Zevachim 6:2)', confidence: 'explicit' },
  'yesod-south': { zone: 'mizbeach', el: 'altar.yesod', at: [202.5, 305.8, 17], note: 'the southern yesod at the SW end: the remainder of the outer-altar bloods (Zevachim 5:3; Tamid 4:1; Middot 3:2)', confidence: 'explicit' },
  kevesh: { zone: 'kevesh', el: 'altar.kevesh', note: 'the ramp: up on the east side, round to the right, down on the west (Zevachim 6:3)', confidence: 'explicit' },
  'kevesh-salting': { zone: 'kevesh', el: 'altar.kevesh', f: [0.25, 0.3, 0], note: 'lower half of the ramp, west side: limbs laid and salted (Tamid 4:3, of the tamid; Rambam MK 6:4 "brought to the ramp and salted there")', confidence: 'derived' },
  'ramp-sovev': { zone: 'kevesh', el: 'altar.kevesh.ramp-sovev', note: 'the small ramp turning off to the sovev (Zevachim 62b; Rambam BhB 2:14)', confidence: 'explicit' },
  sovev: { zone: 'mizbeach', el: 'altar.sovev', note: 'the ledge round the altar at six amot, walked for the chatat and the bird olah (Zevachim 5:3, 6:5)', confidence: 'explicit' },
  'horn-se': { zone: 'mizbeach', el: 'altar.keren.se', note: 'SE horn: first of the chatat\'s four; bird olah on the sovev here (Zevachim 5:3, 6:5)', confidence: 'explicit' },
  'horn-ne': { zone: 'mizbeach', el: 'altar.keren.ne', note: 'NE horn (Zevachim 5:3)', confidence: 'explicit' },
  'horn-nw': { zone: 'mizbeach', el: 'altar.keren.nw', note: 'NW horn (Zevachim 5:3)', confidence: 'explicit' },
  'horn-sw': { zone: 'mizbeach', el: 'altar.keren.sw', note: 'SW horn: last of the chatat\'s four; above the line the wine (Zevachim 5:3, 6:2)', confidence: 'explicit' },
  maarachah: { zone: 'mizbeach', el: 'altar.maarachah-area', f: [0.85, 0.5, 1], note: 'the great pile on the east of the altar top (Tamid 2:4; Rambam TuM 2:4)', confidence: 'explicit' },
  cups: { zone: 'mizbeach', el: 'altar.libation-cups', note: 'the silver cups at the SW horn for the wine (Sukkah 4:9; Zevachim 6:2)', confidence: 'explicit' },
  'table-marble': { zone: 'kevesh', el: 'altar.table.marble', note: 'marble table west of the ramp: limbs laid on it (Shekalim 6:4)', confidence: 'explicit' },
  'table-silver': { zone: 'kevesh', el: 'altar.table.silver', note: 'silver table west of the ramp: the service vessels (Shekalim 6:4)', confidence: 'explicit' },
  'beit-hadeshen': { zone: 'kevesh', el: 'altar.beit-hadeshen', note: 'the ash place east of the ramp: bird crops and feathers (Zevachim 6:5); disqualified and left-over most-holy meat burned "in the court, east of the ramp" (Rambam MK 7:3; Zevachim 104b) — the model takes these as one place', confidence: 'derived' },
  tenufah: { zone: 'ezrat-kohanim', at: [237.5, 321.5, 16], note: '"before God" — east of the altar (Rambam MK 9:6, from Menachot 61a)', confidence: 'derived' },
  kemitzah: { zone: 'azarah', at: [203, 290, 16], note: 'a handful is taken anywhere in the court (Zevachim 6:1); the model uses the pavement west of the ramp, by the silver table of vessels', confidence: 'reconstruction' },
  hagashah: { zone: 'bein-haulam-lamizbeach', el: 'altar.keren.sw', at: [200.8, 305.4, 16], note: 'the meal-offering brought to the point of the SW horn, below (Zevachim 6:2; Rambam MK 13:12)', confidence: 'explicit' },
  kitchen: { zone: 'ezrat-kohanim', at: [238.5, 295, 16], note: 'where the most-holy meat is cooked and the meal-offerings baked — inside the court (Zevachim 11:4; Rambam MK 12:22–23) but not located by the sources; the model uses the south-east of Ezrat Kohanim', confidence: 'reconstruction' },
  meal: { zone: 'ezrat-kohanim', at: [238.5, 300, 16], note: 'male kohanim eat the most-holy portions "within the hangings" (Zevachim 5:3); place in the court not stated; standing — no one sits in the Azarah (Rambam BhB 7:6)', confidence: 'reconstruction' },
  'nazirites-chamber': { zone: 'en-chamber-nazirites', el: 'en.chamber.nazirites', note: 'SE chamber of Ezrat Nashim: nazirites cook their shelamim, shave, put the hair under the pot (Middot 2:5)', confidence: 'explicit' },
  'lepers-chamber': { zone: 'en-chamber-lepers', el: 'en.chamber.lepers', note: 'NW chamber of Ezrat Nashim: the metzora immerses on his eighth day (Middot 2:5; Negaim 14:8)', confidence: 'explicit' },
  city: { zone: 'outside', note: 'the lesser offerings are eaten anywhere within the wall of Jerusalem (Kelim 1:8; Zevachim 5:6–8): carried out of the Mount, leaving by the left (Middot 2:2)', confidence: 'explicit' },
};

// ======================================================================================== attire (what to dress)
const ATTIRE = {
  kohen: 'Four white linen garments — ketonet, michnasayim, avnet (32 amot, wound), migba\'at — barefoot on the stone; hands and feet washed at the kiyor before the first service (Yoma 7:5; Report §34.1)',
  owner: 'His own clothes (tunic, mantle); no staff, shoes, money-belt or dust on his feet on Har HaBayit (Berachot 9:5) — so barefoot; enters the Ezrat Kohanim only to lean, slaughter or wave (Kelim 1:8)',
  woman: 'Her own dress, head covered; a woman does not lean (Menachot 9:8) or wave, except a sotah and a nezirah (Rambam MK 9:16); a yoledet who has immersed still stays outside Ezrat Yisrael until her offering is made (Kelim 1:8)',
  nazir: 'Long uncut hair until the shaving in the nazirites\' chamber; shaved head after it (Nazir 6:7–8)',
  metzora: 'Shaved of all his hair — head, beard, eyebrows — on the seventh day (Negaim 14:3; Vayikra 14:9); garments washed; immerses in the lepers\' chamber on the eighth (Negaim 14:8)',
};

// ======================================================================================== step builders
const A = (role, count, pose = 'stand', extra = {}) => ({ role, count, pose, ...extra });
const K = (count, pose = 'stand', extra = {}) => A('kohen', count, pose, extra);
const OWNER = (pose = 'stand', extra = {}) => A('israelite', 1, pose, { note: 'the owner', ...extra });

const arrive = (gate, animals, extra = {}) => ({
  id: 'arrive', label: 'The owner leads his animal in', actors: [OWNER('walk')], at: gate, props: [], animals,
  minutes: [3, 10], attire: ATTIRE.owner, sources: ['Kelim 1:8', 'Berachot 9:5', 'Middot 2:2', 'Report §7.3'], confidence: 'reconstruction',
  note: 'Which gate is reconstruction (the gate names only are sourced). The animal is first checked for blemishes; Jerusalem had paid examiners of blemishes (Ketubot 106a) — where they sat is not recorded.', ...extra,
});
const sealStep = () => ({
  id: 'seal', label: 'Libations bought by seal', actors: [OWNER('walk'), A('israelite', 2, 'stand', { note: 'Yochanan ben Pinchas over the seals; Achiyah over the libations — lineage not stated' })],
  at: 'seals', props: ['flask', 'bowl'], animals: [], minutes: [3, 8], attire: ATTIRE.owner,
  sources: ['Shekalim 5:1', 'Shekalim 5:3', 'Shekalim 5:4'], confidence: 'reconstruction',
  note: 'Seals marked calf, male (ram), kid (flock), sinner (the metzora\'s three animals) (Shekalim 5:3). Done before or after the slaughter; where the officers sat is the model\'s.',
});
const lean = (words, at) => ({
  id: 'semichah', label: words === 'viduy' ? 'Leaning and confession' : words === 'praise' ? 'Leaning and words of praise' : 'Leaning',
  actors: [OWNER('stand', { gesture: 'semichah', note: 'the owner, both hands with all his strength on the head between the horns, facing west (Rambam MK 3:13–14); partners lean one after another (Menachot 9:9; MK 3:9)' })],
  at, props: [], animals: ['the offering, standing, facing west'], minutes: [1, 3], attire: ATTIRE.owner,
  sources: ['Menachot 9:8', 'Rambam MK 3:6', 'Rambam MK 3:13–15', 'Kelim 1:8'], confidence: 'explicit',
  note: words === 'viduy' ? 'Confession: "I have sinned, I have done iniquity, I have transgressed, and did such-and-such; I have repented before You and this is my atonement" (Rambam MK 3:15). For an olah, the sin of a positive commandment (MK 3:14).'
    : words === 'praise' ? 'No confession on a shelamim; he says words of praise — the Rambam\'s own reading ("it appears to me", MK 3:15).' : undefined,
});
const slaughter = (at, sanctity) => ({
  id: 'shechitah', label: 'Slaughter, and the blood received in a service vessel',
  actors: [A('israelite', 1, 'slaughter', { prop: 'knife', note: 'the owner, or a kohen — slaughter is valid by a non-kohen (Zevachim 3:1); immediately after the leaning, in the same place (Menachot 9:8)' }),
    K(1, 'kneel', { prop: 'mizrak_silver', gesture: 'kabbalah', note: 'receives the blood in a mizrak, a service vessel (Zevachim 5:1–7)' })],
  at, props: ['knife', 'mizrak_silver'], animals: ['bound at a ring, head south, face west (Tamid 4:1, of the tamid)'], minutes: [0.5, 1.5], attire: ATTIRE.kohen,
  sources: sanctity === 'kk' ? ['Zevachim 5:3–5', 'Rambam MK 5:2', 'Menachot 9:8', 'Zevachim 3:1', 'Middot 3:5'] : ['Zevachim 5:6–8', 'Rambam MK 5:4', 'Menachot 9:8', 'Zevachim 3:1'],
  confidence: sanctity === 'kk' ? 'explicit' : 'derived',
  note: sanctity === 'kk' ? 'Most-holy: slaughtered and received in the north only (Zevachim 5:1).' : 'Lesser offerings: anywhere in the court (Zevachim 5:6–8); the model uses the eastern rows of rings.',
});
const carryBlood = (to) => ({
  id: 'holachah', label: 'The blood carried to the altar', actors: [K(1, 'walk', { prop: 'mizrak_silver' })], at: to, props: ['mizrak_silver'], animals: [],
  minutes: [0.5, 1], attire: ATTIRE.kohen, sources: ['Zevachim 1:4', 'Yoma 2:3'], confidence: 'explicit',
});
const bloodTwoFour = () => ({
  id: 'zerikah', label: 'Blood thrown: two that are four, below the red line',
  actors: [K(1, 'throw', { prop: 'mizrak_silver', note: 'from the vessel, at the NE corner then the SW, so the blood wraps each corner like a gamma (Rambam MK 5:6)' })],
  at: ['altar-ne', 'altar-sw', 'yesod-south'], props: ['mizrak_silver'], animals: [], minutes: [0.5, 1.5], attire: ATTIRE.kohen,
  sources: ['Zevachim 5:4–7', 'Tamid 4:1', 'Kinnim 1:1', 'Middot 3:1', 'Rambam MK 5:6'], confidence: 'explicit',
  note: 'The olah, asham and shelamim alike: below the chut hasikra (Kinnim 1:1, "olat behemah below"); the remainder poured on the southern yesod (Tamid 4:1; MK 5:6). The SE corner, without a yesod, is not used (Rambam MK 5:6).',
});
const bloodChatat = () => ({
  id: 'matanot', label: 'The chatat\'s blood on the four horns, from the sovev',
  actors: [K(1, 'sprinkle', { prop: 'mizrak_silver', gesture: 'finger', note: 'dips his right forefinger for each horn, wipes it on the vessel\'s rim between (Rambam MK 5:7–8)' })],
  at: ['kevesh', 'ramp-sovev', 'horn-se', 'horn-ne', 'horn-nw', 'horn-sw', 'yesod-south'], props: ['mizrak_silver'], animals: [], minutes: [3, 6], attire: ATTIRE.kohen,
  sources: ['Zevachim 5:3', 'Rambam MK 5:7–10', 'Middot 3:1', 'Vayikra 4:30'], confidence: 'explicit',
  note: 'Up the ramp, right onto the sovev, then the horns SE → NE → NW → SW, on the upper half; the remainder poured on the southern yesod (Zevachim 5:3).',
});
const bloodOne = () => ({
  id: 'matanah-achat', label: 'One pouring of blood against the yesod',
  actors: [K(1, 'pour', { prop: 'mizrak_silver', gesture: 'shefichah', note: 'poured from the vessel against the yesod, not thrown (Rambam MK 5:17, "בשפיכה")' })], at: ['altar-ne', 'altar-sw'], props: ['mizrak_silver'], animals: [], minutes: [0.5, 1], attire: ATTIRE.kohen,
  sources: ['Zevachim 5:8', 'Rambam MK 5:17', 'Zevachim 37a', 'Pesachim 5:6'], confidence: 'explicit',
  note: 'One application at any of the three corners that have a yesod beneath them (the SE has none) — poured, per the Rambam (MK 5:17). The Mishnah says only "provided he puts it against the yesod" (Zevachim 5:8); Zevachim 37a weighs throwing against pouring (R\' Akiva: "throwing is not included in pouring, nor pouring in throwing"), and of the Pesach the Mishnah says "he throws it, one throw" (Pesachim 5:6). The model follows the Rambam.',
});
const hangFlay = (animal, whole) => ({
  id: 'hefshet', label: whole ? 'Hung, flayed and cut into its limbs' : 'Hung and flayed; the fats taken out',
  actors: [K(animal === 'bull' ? 3 : 1, 'stand', { prop: 'knife', gesture: 'flay' })],
  at: ['nanasin', 'marble-tables'], props: ['knife', 'limb', 'lamb_carcass', 'bowl'], animals: [`${animal}, hung by a hind leg pierced at the hock (Tamid 4:2)`],
  minutes: animal === 'bull' ? [25, 45] : [10, 20], attire: ATTIRE.kohen,
  sources: whole ? ['Middot 3:5', 'Tamid 4:2–3', 'Zevachim 5:4', 'Rambam MK 6:5–9'] : ['Middot 3:5', 'Rambam MK 5:18', 'Rambam MK 1:18', 'Vayikra 3:3–4'],
  confidence: 'explicit',
  note: whole ? 'Cut in the tamid\'s order: head, legs, forelegs, right hind leg, breast, right flank with the liver, neck with windpipe, heart and lungs, left flank with the spleen, tail with the fat-tail, liver-lobe and kidneys (Tamid 4:2–3).'
    : 'Flaying follows the blood (Rambam MK 5:18). The eimurim: the fat over and on the innards, the two kidneys with their fat, the lobe of the liver; of a sheep also the whole fat-tail (Vayikra 3:3–4, 9–10; Rambam MK 1:18).',
});
const rinse = () => ({
  id: 'hadachah', label: 'The innards rinsed', actors: [K(1, 'carry', { prop: 'bowl' })], at: ['medichin', 'marble-tables'], props: ['bowl'], animals: [],
  minutes: [5, 12], attire: ATTIRE.kohen, sources: ['Tamid 4:2', 'Middot 5:3', 'Shekalim 6:4'], confidence: 'explicit',
  note: 'The stomach in the rinsers\' chamber as long as needed; the intestines at least three times on the marble tables (Tamid 4:2).',
});
const hide = () => ({
  id: 'or', label: 'The hide to the Parvah to be salted', actors: [K(1, 'carry_shoulder')], at: 'parvah', props: [], animals: ['the hide'],
  minutes: [3, 6], attire: ATTIRE.kohen, sources: ['Middot 5:3', 'Zevachim 12:3', 'Pesachim 57a'], confidence: 'explicit',
  note: 'Hides of the most-holy offerings belong to the kohanim (Zevachim 12:3); salted in the Parvah and shared among the beit av in the evening — later, every Friday among both watches (Pesachim 57a).',
});
const carryUp = (carriers, what, sources = ['Yoma 2:5–7', 'Rambam MK 6:4', 'Rambam MK 6:10–18', 'Zevachim 6:3', 'Middot 5:3']) => ({
  id: 'haalaah', label: `${what} salted on the ramp and burned on the great pile`,
  actors: [K(carriers, 'carry_walk', { prop: 'limb', note: `${carriers > 1 ? `${carriers} kohanim` : 'one kohen'}: salt from Lishkat HaMelach on the lower west half of the ramp; up on the east side, thrown across the hair's-breadth gap onto the fire, down on the west` })],
  at: ['melach', 'kevesh-salting', 'kevesh', 'maarachah'], props: ['limb', 'bowl'], animals: [], minutes: [4, 8], attire: ATTIRE.kohen,
  sources, confidence: 'explicit',
  note: 'The fats and limbs then burn for hours; what is not consumed by nightfall burns on through the night (Megillah 2:6; Rambam MK 4:2–3).',
});
const tenufah = (what, woman = false) => ({
  id: 'tenufah', label: `Waving ${what}`,
  actors: woman ? [K(1, 'raise_hands_low', { gesture: 'tenufah', note: 'a woman\'s offering is waved by the kohen alone — except a sotah\'s and a nezirah\'s, which they wave themselves (Rambam MK 9:16; Menachot 61b)' })]
    : [OWNER('raise_hands_low', { gesture: 'tenufah', note: 'the parts on the owner\'s palms' }), K(1, 'raise_hands_low', { gesture: 'tenufah', note: 'his hands beneath the owner\'s (Rambam MK 9:6; Menachot 61b)' })],
  at: 'tenufah', props: [], animals: [], minutes: [2, 4], attire: ATTIRE.kohen,
  sources: ['Menachot 5:6', 'Menachot 61b', 'Rambam MK 9:6–8', 'Rambam MK 9:16'], confidence: 'derived',
  note: 'Out to each direction and back, up and down (MK 9:7); fats at the bottom, breast and thigh on them, kidneys and liver-lobe above, bread on top (MK 9:8).',
});
const eatKK = (what) => ({
  id: 'achilah', label: `${what} eaten by male kohanim in the court`,
  actors: [K(4, 'stand', { gesture: 'eat', note: 'male kohanim of the day\'s beit av; standing — no sitting in the Azarah (Rambam BhB 7:6)' })],
  at: ['kitchen', 'meal'], props: ['bowl'], animals: [], minutes: [30, 60], attire: ATTIRE.kohen,
  sources: ['Zevachim 5:3', 'Zevachim 5:5', 'Zevachim 6:1', 'Rambam MK 10:3', 'Rambam MK 10:8', 'Zevachim 11:4', 'Zevachim 11:7'], confidence: 'explicit',
  note: 'Prepared in any manner, that day and the night until midnight (the Torah: until dawn). Copper pots in which a chatat was cooked are scoured with hot water and rinsed with cold, earthenware ones broken — in the court (Zevachim 11:4, 11:7).',
});
const takeOut = (what, until) => ({
  id: 'achilah', label: `${what} carried out to be eaten in Jerusalem`,
  actors: [OWNER('carry_walk', { prop: 'basket' })], at: 'city', props: ['basket'], animals: [], minutes: [2, 5], attire: ATTIRE.owner,
  sources: ['Zevachim 5:6–8', 'Kelim 1:8', 'Rambam MK 10:6–8'], confidence: 'explicit',
  note: `Eaten by anyone pure, anywhere within the city wall, ${until}; the kohen's portion goes with him to his household.`,
});
const nesachimStep = (animal) => ({
  id: 'nesachim', label: 'Its meal-offering burned and its wine poured at the SW horn',
  actors: [K(1, 'carry_walk', { prop: 'bowl', note: `flour (${NESACHIM[animal].solet} isaron) mixed with ${NESACHIM[animal].oil} log oil, salted, burned whole (Menachot 6:2)` }),
    K(1, 'pour', { prop: 'flask', note: `${NESACHIM[animal].wine} log wine: up the ramp, straight to the SW horn, poured into the cup, back down on his heel (Zevachim 6:2–3)` })],
  at: ['table-silver', 'kevesh', 'horn-sw', 'cups', 'maarachah'], props: ['bowl', 'flask'], animals: [], minutes: [3, 6], attire: ATTIRE.kohen,
  sources: ['Menachot 9:3', 'Menachot 9:6', 'Menachot 6:2', 'Zevachim 6:2–3', 'Bamidbar 15:4–10', 'Report §65.1', 'Rambam MK 4:5'], confidence: 'explicit',
  note: 'Brought by day; they may follow the offering later, even the next day (Rambam MK 4:5).',
});

// ======================================================================================== libations per animal
/** Bamidbar 15:4–10; Menachot 9:3 (hin = 12 log); report §65.1. Flour in esronim, oil and wine in log. */
export const NESACHIM = {
  lamb: { solet: 1, oil: 3, wine: 3, seal: 'gedi (flock)' },
  kid: { solet: 1, oil: 3, wine: 3, seal: 'gedi (flock)' },
  ram: { solet: 2, oil: 4, wine: 4, seal: 'zachar' },
  bull: { solet: 3, oil: 6, wine: 6, seal: 'egel' },
};

// ======================================================================================== the types
const SHEEP = (sex, age, extra = {}) => ({ species: 'sheep', sex, age, runtime: age === 'second year' ? 'ram' : 'lamb', ...extra });
const GOAT = (sex, age, extra = {}) => ({ species: 'goat', sex, age, runtime: 'goat', ...extra });
const CATTLE = (sex, age, extra = {}) => ({ species: 'cattle', sex, age, runtime: 'bull', ...extra });

export const OFFERING_TYPES = {
  // ---------------------------------------------------------------- most-holy animal offerings
  olah: {
    id: 'olah', names: { en: 'Burnt-offering (of an animal)', he: 'עולה', translit: 'olah' },
    category: 'kodshei kodashim', form: 'animal',
    animals: [SHEEP('male', 'first year'), SHEEP('male', 'second year'), GOAT('male', 'first or second year'), CATTLE('male', 'up to three years', { note: 'a calf (first year) or a bull (Rambam MK 1:14)' })],
    broughtBy: 'Any Israelite man or woman (Rambam MK 3:2); a gentile may bring only an olah (MK 3:3)',
    occasions: ['a vow ("it is on me to bring an olah") or a freewill gift ("this is an olah") (Kinnim 1:1)', 'atonement for a positive commandment neglected (Rambam MK 3:14)', 'part of the nazir\'s, the metzora\'s and the yoledet\'s sets', 'olot bought from the nedavah chests and from surplus funds — kayitz hamizbeach (Shekalim 6:6; 4:4)'],
    slaughter: { where: 'north', at: 'rings', sources: ['Zevachim 5:4'] },
    semichah: { required: true, words: 'viduy', note: 'not when bought from chest money — the giver is not its owner (Rambam MK 3:7)' },
    blood: { rite: 'two-that-are-four', corners: ['ne', 'sw'], level: 'below', remainder: 'southern yesod', sources: ['Zevachim 5:4', 'Tamid 4:1', 'Kinnim 1:1'] },
    burned: 'All of it, flayed and cut into limbs (Zevachim 5:4)', eaten: null, hide: 'to the kohanim (Vayikra 7:8; Zevachim 12:2)',
    nesachim: 'per animal (Menachot 9:6)',
    steps: [arrive('gate-korban', ['lamb, ram, goat or bull']), sealStep(), lean('viduy', 'rings'), slaughter('rings', 'kk'), carryBlood('altar-ne'), bloodTwoFour(),
      hangFlay('lamb', true), rinse(), hide(), carryUp(6, 'The limbs (a lamb: six carriers; a ram eleven, a bull twenty-four, counting flour and wine)'), nesachimStep('lamb')],
    frequency: { lo: 6, hi: 20, unit: 'animals per weekday in Cheshvan' },
    sources: ['Zevachim 5:4', 'Tamid 4:1–3', 'Yoma 2:5–7', 'Rambam MK 1:8', 'Rambam MK 6:1–18'],
    notes: 'Carriers per Yoma 2:5–7 (lamb 6 + flour + wine = 8 in Rambam MK 6:17; ram 11; bull 24). The Mishnah gives the counts for public offerings; the Rambam states them of every olah.',
  },
  chatat: {
    id: 'chatat', names: { en: 'Sin-offering (of an individual, eaten)', he: 'חטאת', translit: 'chatat' },
    category: 'kodshei kodashim', form: 'animal',
    animals: [SHEEP('female', 'first year', { note: 'kisbah — a ewe lamb' }), GOAT('female', 'first year', { note: "se'irah — a she-goat" })],
    broughtBy: 'One who sinned unwittingly in a matter whose deliberate violation is karet (Vayikra 4:27–35); the nazir and the metzora; the sliding-scale chatat of the well-off (Vayikra 5:1–13)',
    occasions: ['shegagah — an unwitting sin', 'nazir completing his term (ewe)', 'metzora on his eighth day (ewe)', 'korban oleh veyored of one who can afford an animal'],
    slaughter: { where: 'north', at: 'rings', sources: ['Zevachim 5:3'] },
    semichah: { required: true, words: 'viduy' },
    blood: { rite: 'four-horns', corners: ['se', 'ne', 'nw', 'sw'], level: 'above (on the horns, from the sovev)', remainder: 'southern yesod', sources: ['Zevachim 5:3', 'Rambam MK 5:7–10'] },
    burned: 'The eimurim only (Vayikra 4:31)', eaten: { by: 'male kohanim', where: 'within the court ("within the hangings")', until: 'that day and the night until midnight', sources: ['Zevachim 5:3'] },
    hide: 'to the kohanim (Zevachim 12:3)', nesachim: 'none, except the metzora\'s (Menachot 9:6)',
    steps: [arrive('gate-korban', ['ewe lamb or she-goat']), lean('viduy', 'rings'), slaughter('rings', 'kk'), carryBlood('kevesh'), bloodChatat(),
      hangFlay('lamb', false), rinse(), hide(), carryUp(1, 'The eimurim'), eatKK('The meat')],
    frequency: { lo: 2, hi: 8, unit: 'animals per weekday in Cheshvan' },
    sources: ['Zevachim 5:3', 'Vayikra 4:27–35', 'Rambam MK 1:9', 'Rambam MK 1:15', 'Rambam MK 5:7–10', 'Rambam MK 10:3'],
    notes: 'Every chatat precedes the olah brought with it — even a bird chatat precedes an animal olah (Zevachim 89a–90a; Mishnah Zevachim 10:2, 10:4). Blood spattered on a garment is laundered in the court (Zevachim 11:1–4).',
  },
  asham: {
    id: 'asham', names: { en: 'Guilt-offering', he: 'אשם', translit: 'asham' },
    category: 'kodshei kodashim', form: 'animal',
    animals: [SHEEP('male', 'second year', { note: 'a ram — for theft (gezelot), me\'ilah, the betrothed maidservant, and the conditional asham talui' }), SHEEP('male', 'first year', { note: 'a lamb — the nazir\'s and the metzora\'s' })],
    broughtBy: 'Men and women; the nazir who became impure; the metzora',
    occasions: ['asham gezelot (a false oath over another\'s money)', 'asham me\'ilot (unwitting use of hekdesh)', 'asham shifchah charufah', 'asham nazir', 'asham metzora', 'asham talui (a doubtful sin)'],
    slaughter: { where: 'north', at: 'rings', sources: ['Zevachim 5:5'] },
    semichah: { required: true, words: 'viduy' },
    blood: { rite: 'two-that-are-four', corners: ['ne', 'sw'], level: 'below', remainder: 'southern yesod', sources: ['Zevachim 5:5', 'Rambam MK 5:6'] },
    burned: 'The eimurim (Vayikra 7:3–5)', eaten: { by: 'male kohanim', where: 'within the court', until: 'that day and the night until midnight', sources: ['Zevachim 5:5'] },
    hide: 'to the kohanim (Zevachim 12:3)', nesachim: 'none, except the metzora\'s (Menachot 9:6)',
    steps: [arrive('gate-korban', ['ram (or lamb)']), lean('viduy', 'rings'), slaughter('rings', 'kk'), carryBlood('altar-ne'), bloodTwoFour(),
      hangFlay('ram', false), rinse(), hide(), carryUp(1, 'The eimurim'), eatKK('The meat')],
    frequency: { lo: 1, hi: 5, unit: 'animals per weekday in Cheshvan' },
    sources: ['Zevachim 5:5', 'Rambam MK 1:10', 'Rambam MK 9:1'],
  },
  // ---------------------------------------------------------------- lesser (kodashim kalim) animal offerings
  shelamim: {
    id: 'shelamim', names: { en: 'Peace-offering', he: 'שלמים', translit: 'shelamim' },
    category: 'kodashim kalim', form: 'animal',
    animals: [SHEEP('male or female', 'first or second year'), GOAT('male or female', 'first or second year'), CATTLE('male or female', 'up to three years', { note: 'a cow or a bull (Rambam MK 1:11) — the runtime has only a bull' })],
    broughtBy: 'Men and women, alone or in partnership (Rambam MK 3:1–2)',
    occasions: ['a vow or freewill gift', 'a family celebration', 'eaten as a festive meal with family and friends in the city'],
    slaughter: { where: 'anywhere in the court', at: 'rings', sources: ['Zevachim 5:7'] },
    semichah: { required: true, words: 'praise' },
    blood: { rite: 'two-that-are-four', corners: ['ne', 'sw'], level: 'below', remainder: 'southern yesod', sources: ['Zevachim 5:7', 'Rambam MK 5:6'] },
    burned: 'The eimurim, after the waving (Rambam MK 9:11)',
    eaten: { by: 'anyone pure; breast and right thigh to the kohanim and their households', where: 'anywhere in Jerusalem', until: 'two days and the night between (Zevachim 5:7)', sources: ['Zevachim 5:7', 'Rambam MK 10:4–6'] },
    hide: 'to the owner (lesser offerings)', nesachim: 'per animal (Menachot 9:6)',
    steps: [arrive('gate-korban', ['lamb, ram, goat, calf or cow']), sealStep(), lean('praise', 'rings'), slaughter('rings', 'kalim'), carryBlood('altar-ne'), bloodTwoFour(),
      hangFlay('lamb', false), rinse(), tenufah('the fats, breast and thigh'), carryUp(1, 'The eimurim'), nesachimStep('lamb'), takeOut('The meat', 'for two days and the night between')],
    frequency: { lo: 5, hi: 20, unit: 'animals per weekday in Cheshvan' },
    sources: ['Zevachim 5:7', 'Menachot 5:6', 'Rambam MK 9:5–11', 'Rambam MK 10:6'],
    notes: 'The kohanim may take the breast and thigh only after the eimurim are on the fire (Pesachim 59b; Rambam MK 9:11).',
  },
  todah: {
    id: 'todah', names: { en: 'Thanksgiving-offering', he: 'תודה', translit: 'todah' },
    category: 'kodashim kalim', form: 'animal',
    animals: [SHEEP('male or female', 'first or second year'), GOAT('male or female', 'first or second year'), CATTLE('male or female', 'up to three years')],
    breads: { count: 40, kinds: ['10 leavened loaves', '10 unleavened challot mixed with oil', '10 rekikin (wafers) smeared with oil', '10 revuchah (scalded, soaked in oil)'], flour: '20 esronim — 5 Jerusalem se\'ah', oil: '½ log', teruma: 'one of each kind to the kohen who throws the blood (Menachot 7:2)', sources: ['Menachot 7:1–2', 'Rambam MK 9:17–22'] },
    broughtBy: 'One who came safely through the sea or the desert, out of prison, or up from illness (Berachot 54b)',
    occasions: ['a sea voyage', 'a desert crossing', 'release from prison', 'recovery from illness'],
    slaughter: { where: 'anywhere in the court', at: 'rings', sources: ['Zevachim 5:6'] },
    semichah: { required: true, words: 'praise' },
    blood: { rite: 'two-that-are-four', corners: ['ne', 'sw'], level: 'below', remainder: 'southern yesod', sources: ['Zevachim 5:6'] },
    burned: 'The eimurim',
    eaten: { by: 'anyone pure; breast, thigh and four loaves to the kohen', where: 'anywhere in Jerusalem', until: 'that day and the night until midnight (Zevachim 5:6)', sources: ['Zevachim 5:6', 'Rambam MK 10:7–8'] },
    hide: 'to the owner', nesachim: 'per animal',
    steps: [arrive('gate-korban', ['the animal, with a basket of 40 loaves']), sealStep(), lean('praise', 'rings'), slaughter('rings', 'kalim'), carryBlood('altar-ne'), bloodTwoFour(),
      hangFlay('lamb', false), rinse(), tenufah('the fats, breast, thigh and four loaves'), carryUp(1, 'The eimurim'), nesachimStep('lamb'), takeOut('The meat and 36 loaves', 'that day and the night until midnight')],
    frequency: { lo: 2, hi: 8, unit: 'animals per weekday in Cheshvan' },
    sources: ['Zevachim 5:6', 'Menachot 7:1–2', 'Berachot 54b', 'Rambam MK 9:5–8', 'Rambam MK 9:17–22'],
    notes: 'The breads are consecrated by the slaughter; four loaves are lifted with the waving (Rambam MK 9:7).',
  },
  bechor: {
    id: 'bechor', names: { en: 'Firstling', he: 'בכור', translit: 'bechor' },
    category: 'kodashim kalim', form: 'animal',
    animals: [SHEEP('male', 'first year (from the 8th day)'), GOAT('male', 'first year'), CATTLE('male', 'first year')],
    broughtBy: 'The kohen to whom the owner gave it (Bamidbar 18:17–18)',
    occasions: ['the firstborn male of a cow, ewe or she-goat, within its first year'],
    slaughter: { where: 'anywhere in the court', at: 'rings', sources: ['Zevachim 5:8'] },
    semichah: { required: false, words: null, note: 'no leaning on a firstling (Menachot 9:7)' },
    blood: { rite: 'one', corners: ['any with a yesod'], level: 'against the yesod', remainder: null, sources: ['Zevachim 5:8', 'Rambam MK 5:17'] },
    burned: 'The eimurim', eaten: { by: 'kohanim and their households', where: 'anywhere in Jerusalem', until: 'two days and the night between', sources: ['Zevachim 5:8'] },
    hide: 'the kohen\'s', nesachim: 'none (Menachot 9:6)',
    steps: [arrive('gate-bechorot', ['a firstling lamb, kid or calf'], { actors: [K(1, 'walk', { note: 'the kohen who received it brings it; in his own clothes until he serves' })] }), slaughter('rings', 'kalim'), carryBlood('altar-ne'), bloodOne(),
      hangFlay('lamb', false), carryUp(1, 'The eimurim'), takeOut('The meat', 'for two days and the night between')],
    frequency: { lo: 2, hi: 8, unit: 'animals per weekday in Cheshvan' },
    sources: ['Zevachim 5:8', 'Menachot 9:6–7', 'Rambam MK 5:17', 'Rambam MK 9:25'],
  },
  maaser: {
    id: 'maaser', names: { en: 'Animal tithe', he: 'מעשר בהמה', translit: "ma'aser behemah" },
    category: 'kodashim kalim', form: 'animal',
    animals: [SHEEP('male or female', 'of the year\'s births'), GOAT('male or female', 'of the year\'s births'), CATTLE('male or female', 'of the year\'s births')],
    broughtBy: 'The owner of the herd', occasions: ['every tenth animal of the year\'s births, counted at the three tithing-times before Pesach, Shavuot and Sukkot (Bekhorot 9:5)'],
    slaughter: { where: 'anywhere in the court', at: 'rings', sources: ['Zevachim 5:8'] },
    semichah: { required: false, words: null, note: 'no leaning (Menachot 9:7)' },
    blood: { rite: 'one', corners: ['any with a yesod'], level: 'against the yesod', remainder: null, sources: ['Zevachim 5:8'] },
    burned: 'The eimurim', eaten: { by: 'anyone pure (the owner)', where: 'anywhere in Jerusalem', until: 'two days and the night between', sources: ['Zevachim 5:8'] },
    hide: 'the owner\'s', nesachim: 'none',
    steps: [arrive('gate-korban', ['a tithe lamb, kid or calf (marked with red ochre at the counting — Bekhorot 9:7)']), slaughter('rings', 'kalim'), carryBlood('altar-ne'), bloodOne(), hangFlay('lamb', false), carryUp(1, 'The eimurim'), takeOut('The meat', 'for two days and the night between')],
    frequency: { lo: 0, hi: 2, unit: 'animals per weekday in Cheshvan', note: 'tithed before the festivals and mostly eaten at them; a month after Sukkot it is rare' },
    sources: ['Zevachim 5:8', 'Bekhorot 9:5', 'Menachot 9:7'],
  },
  // ---------------------------------------------------------------- birds (most-holy)
  'olat-haof': {
    id: 'olat-haof', names: { en: 'Bird burnt-offering', he: 'עולת העוף', translit: "olat ha'of" },
    category: 'kodshei kodashim', form: 'bird',
    birds: [{ species: 'turtledove', age: 'grown — torim are fit only when grown', runtime: 'dove' }, { species: 'pigeon', age: 'young — bnei yonah only before the yellow of the neck feathers (Chullin 1:5)', runtime: 'dove' }],
    broughtBy: 'The poor instead of an animal; one of each obligatory pair; vows and gifts of a single bird or a pair (Kinnim 1:1; Menachot 104b)',
    occasions: ['the second bird of a yoledet\'s, zav\'s or zavah\'s pair', 'the poor metzora\'s and the sliding-scale sinner\'s pair', 'vows and gifts — all olot (Kinnim 1:1)', 'gozlei olah bought from the chest of that name (Shekalim 6:5)'],
    slaughter: { where: 'melikah on the sovev at the SE horn', at: 'horn-se', sources: ['Zevachim 6:5'] },
    semichah: { required: false, words: null, note: 'a bird takes no leaning (Rambam MK 3:7)' },
    blood: { rite: 'melikah-olah', corners: ['se'], level: 'above (from the sovev)', remainder: 'squeezed out on the wall', sources: ['Zevachim 6:5', 'Kinnim 1:1'] },
    burned: 'Head and body (Zevachim 6:5)', eaten: null, hide: null, nesachim: 'none',
    steps: [{
      id: 'melikah', label: 'Nipped on the sovev at the SE horn; the blood squeezed out on the wall',
      actors: [K(1, 'stand', { gesture: 'melikah', note: 'up the ramp, onto the sovev, to the SE horn; cuts down at the nape with his thumbnail and severs the head (Zevachim 6:5; Rambam MK 6:20–23)' })],
      at: ['kevesh', 'ramp-sovev', 'sovev', 'horn-se'], props: [], animals: ['a turtledove or young pigeon'], minutes: [1, 2], attire: ATTIRE.kohen,
      sources: ['Zevachim 6:5', 'Kinnim 1:1', 'Rambam MK 6:20–23'], confidence: 'explicit',
      note: 'When birds are many and the east is crowded, at the SW horn above the line (Zevachim 6:2).',
    }, {
      id: 'haktarah', label: 'Head salted and thrown on the fire; the crop and feathers flung to the ash place; the body split and burned',
      actors: [K(1, 'throw')], at: ['maarachah', 'beit-hadeshen'], props: [], animals: [], minutes: [2, 4], attire: ATTIRE.kohen,
      sources: ['Zevachim 6:5', 'Zevachim 64a', 'Rambam MK 6:21–22'], confidence: 'explicit',
      note: 'The throw of crop and feathers from the SE horn to the ash place east of the ramp was a long one (Zevachim 64a; Report §10.8).',
    }],
    frequency: { lo: 20, hi: 60, unit: 'birds per weekday in Cheshvan' },
    sources: ['Zevachim 6:2', 'Zevachim 6:5', 'Kinnim 1:1', 'Chullin 1:5', 'Rambam MK 6:20–23'],
  },
  'chatat-haof': {
    id: 'chatat-haof', names: { en: 'Bird sin-offering', he: 'חטאת העוף', translit: "chatat ha'of" },
    category: 'kodshei kodashim', form: 'bird',
    birds: [{ species: 'turtledove', age: 'grown', runtime: 'dove' }, { species: 'pigeon', age: 'young', runtime: 'dove' }],
    broughtBy: 'The first bird of every obligatory pair (Kinnim 1:1): yoledet, zav, zavah, the poor metzora, the poor sinner',
    occasions: ['completing purification after childbirth or a flux', 'the sliding-scale chatat of the poor'],
    slaughter: { where: 'melikah at the SW corner, from the pavement', at: 'altar-sw', sources: ['Zevachim 6:2', 'Zevachim 6:4', 'Rambam MK 7:6'] },
    semichah: { required: false, words: null },
    blood: { rite: 'melikah-chatat', corners: ['sw'], level: 'below', remainder: 'squeezed out on the yesod', sources: ['Zevachim 6:4', 'Kinnim 1:1'] },
    burned: 'Nothing — the altar has only its blood (Zevachim 6:4)',
    eaten: { by: 'male kohanim', where: 'within the court', until: 'that day and the night until midnight', sources: ['Zevachim 6:4', 'Rambam MK 10:3'] },
    hide: null, nesachim: 'none',
    steps: [{
      id: 'melikah', label: 'Nipped at the SW corner, its blood sprinkled below the red line',
      actors: [K(1, 'stand', { gesture: 'melikah', note: 'feet between two fingers, wings between two, neck over his thumb; nips without severing the head — "one of the hard services of the Mikdash" (Zevachim 64b, correcting "the hardest": the handful of a meal-offering and of incense are hard too; Rambam MK 7:6–8)' })],
      at: ['altar-sw', 'yesod-south'], props: [], animals: ['a turtledove or young pigeon'], minutes: [1, 2], attire: ATTIRE.kohen,
      sources: ['Zevachim 6:2', 'Zevachim 6:4', 'Zevachim 64b', 'Rambam MK 7:6–9'], confidence: 'explicit',
    }, eatKK('The bird')],
    frequency: { lo: 20, hi: 60, unit: 'birds per weekday in Cheshvan' },
    sources: ['Zevachim 6:2', 'Zevachim 6:4', 'Kinnim 1:1', 'Rambam MK 7:6–10'],
    notes: 'A disqualified bird chatat waits in the revuvah of the ramp for its form to decay (Middot 3:3).',
  },
  // ---------------------------------------------------------------- meal-offerings (most-holy)
  'minchat-solet': mealType('minchat-solet', 'Meal-offering of fine flour', 'מנחת סולת', 'minchat solet', 'Flour mixed with oil in a service vessel, oil poured over, frankincense laid on it (Rambam MK 13:5)', false),
  'minchat-machavat': mealType('minchat-machavat', 'Meal-offering fried on a griddle', 'מנחת מחבת', 'minchat machavat', 'Kneaded with warm water and fried on the flat machavat with little oil — firm; broken into pieces, oil poured, frankincense (Menachot 5:8; Rambam MK 13:6–7)', true),
  'minchat-marcheshet': mealType('minchat-marcheshet', 'Meal-offering of the deep pan', 'מנחת מרחשת', 'minchat marcheshet', 'Fried in the deep marcheshet in much oil — soft; broken, oil, frankincense (Menachot 5:8; Rambam MK 13:6–7)', true),
  'minchat-maafeh': mealType('minchat-maafeh', 'Oven-baked meal-offering', 'מנחת מאפה תנור', "minchat ma'afeh tanur", 'Ten challot mixed with oil, or ten rekikin smeared with oil after baking, in the court\'s metal oven (Menachot 5:9, 6:3; Rambam MK 12:23, 13:8)', true),
  'minchat-chotei': {
    ...mealType('minchat-chotei', 'Sinner\'s meal-offering', 'מנחת חוטא', 'minchat chotei', 'A tenth of an ephah of dry flour — no oil, no frankincense (Menachot 5:3–4)', false),
    broughtBy: 'One too poor even for birds, in the sliding-scale cases (Vayikra 5:11–13)',
    occasions: ['korban oleh veyored of the very poor'],
    burned: 'The handful alone (Vayikra 5:12)',
    frequency: { lo: 0, hi: 3, unit: 'per weekday in Cheshvan' },
  },
  // ---------------------------------------------------------------- libations
  nesachim: {
    id: 'nesachim', names: { en: 'Libations (with an animal, or given alone)', he: 'נסכים', translit: 'nesachim' },
    category: 'kodshei kodashim', form: 'libation',
    table: NESACHIM,
    broughtBy: 'Every olah and shelamim of an individual, and the metzora\'s chatat and asham (Menachot 9:6); also vowed alone',
    occasions: ['bought by seal from Yochanan ben Pinchas and received from Achiyah (Shekalim 5:4)'],
    slaughter: null, semichah: { required: false, words: null }, blood: null,
    burned: 'The flour-and-oil wholly; the wine into the cup at the SW horn, down the shitin (Menachot 6:2; Zevachim 6:2; Middot 3:2)', eaten: null, hide: null, nesachim: null,
    steps: [sealStep(), nesachimStep('lamb')],
    frequency: { lo: 0, hi: 0, unit: 'libation sets per weekday in Cheshvan', withEach: ['olah', 'shelamim', 'todah'], withSets: { metzora: ['asham', 'chatat'] },
      note: 'Not drawn by itself: one set comes with every animal olah, shelamim and todah, and with the metzora\'s chatat and asham (Menachot 9:6); lo/hi are computed from those below. A libation vowed alone is rare and not modelled.' },
    sources: ['Menachot 9:2–3', 'Menachot 9:6', 'Menachot 6:2', 'Shekalim 5:3–4', 'Zevachim 6:2–3', 'Bamidbar 15:1–16', 'Report §65.1'],
  },
  // ---------------------------------------------------------------- the composite sets seen at the courts
  nazir: {
    id: 'nazir', names: { en: 'The nazir completes his term', he: 'קרבנות נזיר', translit: 'korbanot nazir' },
    category: 'composite', form: 'set',
    components: [{ type: 'chatat', animal: SHEEP('female', 'first year') }, { type: 'olah', animal: SHEEP('male', 'first year') }, { type: 'shelamim', subtype: 'eil nazir', animal: SHEEP('male', 'second year') }],
    breads: { count: 20, kinds: ['10 challot mixed with oil', '10 rekikin smeared with oil'], oil: '¼ log', sources: ['Menachot 7:2', 'Menachot 9:3', 'Rambam MK 9:23'] },
    broughtBy: 'A nazir at the end of his term (Bamidbar 6:13–20)', occasions: ['completion of a nazirite vow — commonly thirty days or more'],
    slaughter: { where: 'chatat and olah in the north; the ram anywhere', at: 'rings' }, semichah: { required: true, words: 'per animal' },
    blood: { rite: 'per animal' }, burned: 'per animal', eaten: { by: 'the ram: anyone pure, in the city, that day and the night until midnight (Zevachim 5:6); the cooked foreleg, a challah and a rakik to the kohen' }, hide: 'per animal', nesachim: 'for the olah and the ram, not for the chatat — of chataot and ashamot only the metzora\'s take libations (Menachot 9:6)',
    steps: [arrive('gate-korban', ['ewe lamb, male lamb, ram; a basket of 20 loaves'], { actors: [A('nazir', 1, 'walk', { note: 'long uncut hair' })] }),
      { ...lean('viduy', 'rings'), actors: [A('nazir', 1, 'stand', { gesture: 'semichah' })] }, slaughter('rings', 'kk'), bloodChatat(), bloodTwoFour(),
      { id: 'giluach', label: 'He shaves his head in the nazirites\' chamber and casts the hair under the pot of his peace-offering',
        actors: [A('nazir', 1, 'kneel', { gesture: 'shave' }), A('israelite', 1, 'stand', { note: 'the one who shaves him — not stated who' })],
        at: 'nazirites-chamber', props: ['bowl'], animals: [], minutes: [15, 30], attire: ATTIRE.nazir,
        sources: ['Nazir 6:7', 'Nazir 6:8', 'Middot 2:5', 'Rambam MK 9:9'], confidence: 'explicit',
        note: 'After the slaughter of the shelamim (R\' Yehudah) or of the chatat (R\' Elazar) (Nazir 6:7). The ram is cooked in the chamber; the hair burns under the pot (Nazir 6:8).' },
      { ...tenufah('the cooked foreleg, a challah and a rakik on the nazir\'s palms'), actors: [A('nazir', 1, 'raise_hands_low', { gesture: 'tenufah', note: 'a nezirah waves too — with the sotah, the only woman who does (Rambam MK 9:16)' }), K(1, 'raise_hands_low', { gesture: 'tenufah' })], sources: ['Nazir 6:9', 'Rambam MK 9:9', 'Rambam MK 9:16'], confidence: 'explicit',
        note: 'Then he may drink wine (Nazir 6:9). R\' Shimon: already once one of the bloods is thrown. A woman nazir waves her own, like a man (Rambam MK 9:16).' },
      carryUp(6, 'The olah\'s limbs and the eimurim'), nesachimStep('ram'), eatKK('The chatat'), takeOut('The ram and the loaves', 'that day and the night until midnight')],
    frequency: { lo: 0, hi: 3, unit: 'sets per weekday in Cheshvan', yields: { chatat: 1, olah: 1, shelamim: 1 } },
    sources: ['Nazir 6:7–9', 'Middot 2:5', 'Zevachim 5:6', 'Menachot 7:2', 'Bamidbar 6:13–20', 'Rambam MK 9:9'],
  },
  metzora: {
    id: 'metzora', names: { en: 'The healed metzora\'s eighth day', he: 'קרבנות מצורע', translit: "korbanot metzora" },
    category: 'composite', form: 'set',
    components: [{ type: 'asham', animal: SHEEP('male', 'first year') }, { type: 'chatat', animal: SHEEP('female', 'first year'), poor: 'a bird' }, { type: 'olah', animal: SHEEP('male', 'first year'), poor: 'a bird' }],
    meal: { solet: '3 esronim (poor: 1)', oil: 'a log of oil, besides', sources: ['Negaim 14:7', 'Rambam MK 2:6', 'Vayikra 14:10, 21'] },
    broughtBy: 'A healed metzora on the eighth day of his purification (Vayikra 14:10–32)', occasions: ['the end of tzara\'at'],
    slaughter: { where: 'north', at: 'rings' }, semichah: { required: true, words: 'viduy', note: 'he leans on the asham from the gateway, his hands stretched in — he may not yet enter (Rambam MK 3:11)' },
    blood: { rite: 'per animal + thumb/toe/ear' }, burned: 'per animal', eaten: { by: 'male kohanim, in the court', until: 'midnight' }, hide: 'to the kohanim', nesachim: 'for all three, even the chatat and asham (Menachot 9:6); the seal "sinner" (Shekalim 5:3)',
    steps: [
      { id: 'tevilah', label: 'He immerses in the lepers\' chamber', actors: [A('israelite', 1, 'walk', { note: 'the metzora' })], at: 'lepers-chamber', props: [], animals: [], minutes: [5, 15], attire: ATTIRE.metzora, sources: ['Negaim 14:8', 'Middot 2:5'], confidence: 'explicit', note: 'R\' Yehudah: no immersion is needed here (Negaim 14:8).' },
      { id: 'tenufah-chai', label: 'The live asham lamb and the log of oil are waved', actors: [K(1, 'raise_hands_low', { gesture: 'tenufah' }), A('israelite', 1, 'raise_hands_low', { note: 'the metzora' })], at: 'nikanor', props: ['flask'], animals: ['the asham lamb, alive'], minutes: [2, 4], attire: ATTIRE.kohen, sources: ['Menachot 5:6', 'Menachot 5:7', 'Vayikra 14:12'], confidence: 'derived', note: 'Waving while alive and leaning, but no waving after slaughter (R\' Shimon, Menachot 5:7). The place of this waving is the model\'s.' },
      { ...lean('viduy', 'nikanor'), actors: [A('israelite', 1, 'stand', { gesture: 'semichah', note: 'the metzora, from the gateway' })] },
      { id: 'asham', label: 'The asham slaughtered; one kohen takes blood in a vessel, another in his palm', actors: [A('israelite', 1, 'slaughter', { prop: 'knife' }), K(1, 'kneel', { prop: 'mizrak_silver' }), K(1, 'kneel', { gesture: 'palm', note: 'receives blood in his hand' })], at: ['nikanor', 'rings'], props: ['knife', 'mizrak_silver'], animals: ['male lamb'], minutes: [1, 2], attire: ATTIRE.kohen, sources: ['Negaim 14:8'], confidence: 'explicit', note: 'Where the asham is slaughtered when he leans from the gate is not spelled out; it must be in the north (Zevachim 5:5).' },
      { id: 'bohen', label: 'Blood on his right ear, thumb and big toe, each put in through Nikanor', actors: [A('israelite', 1, 'stand', { note: 'head, then hand, then foot thrust into the court; R\' Yehudah: all three at once' }), K(1, 'stand', { gesture: 'apply' })], at: 'nikanor', props: [], animals: [], minutes: [2, 4], attire: ATTIRE.metzora, sources: ['Negaim 14:9', 'Vayikra 14:14'], confidence: 'explicit' },
      { id: 'shemen', label: 'Oil sprinkled seven times toward the Kodesh HaKodashim, then on the same places, the rest on his head', actors: [K(2, 'sprinkle', { prop: 'flask', note: 'one pours from the log into his colleague\'s left palm' })], at: 'nikanor', props: ['flask'], animals: [], minutes: [3, 6], attire: ATTIRE.kohen, sources: ['Negaim 14:10', 'Vayikra 14:15–18'], confidence: 'explicit' },
      bloodTwoFour(), bloodChatat(), carryUp(6, 'The olah\'s limbs and the eimurim'), nesachimStep('lamb'), eatKK('The chatat and asham')],
    frequency: { lo: 0, hi: 1, unit: 'per weekday in Cheshvan', note: 'rare',
      yields: { asham: 1, chatat: 0.5, olah: 0.5, 'chatat-haof': 0.5, 'olat-haof': 0.5 }, yieldsNote: 'a poor metzora brings two birds for the chatat and olah (Vayikra 14:21–22; Negaim 14:7); one in two poor is reconstruction' },
    sources: ['Negaim 14:7–10', 'Middot 2:5', 'Menachot 5:6–7', 'Menachot 9:6', 'Shekalim 5:3', 'Rambam MK 3:11', 'Zevachim 5:5'],
  },
  yoledet: {
    id: 'yoledet', names: { en: 'A mother after childbirth', he: 'קרבן יולדת', translit: 'korban yoledet' },
    category: 'composite', form: 'set',
    components: [{ type: 'chatat-haof', bird: 'a turtledove or young pigeon' }, { type: 'olah', animal: SHEEP('male', 'first year'), poor: 'a second bird as olat ha\'of' }],
    broughtBy: 'A woman at the end of her days of purification — 40 days after a son, 80 after a daughter (Vayikra 12:1–8)',
    occasions: ['childbirth; one offering may cover several births (Keritot 1:7; 2:4)'],
    slaughter: { where: 'the lamb in the north; the birds at the altar', at: 'rings' }, semichah: { required: false, words: null, note: 'a woman does not lean (Menachot 9:8)' },
    blood: { rite: 'per component' }, burned: 'per component', eaten: { by: 'male kohanim: the bird chatat' }, hide: 'the lamb\'s to the kohanim', nesachim: 'for the lamb olah',
    steps: [
      { id: 'kinnin', label: 'Money for her birds into the kinnin chest — or her birds handed in at Nikanor', actors: [A('woman', 1, 'walk', { note: 'the yoledet' })], at: ['kinnin-chest', 'nikanor'], props: ['basket'], animals: ['two birds in a basket, when she brings them herself'], minutes: [2, 6], attire: ATTIRE.woman, sources: ['Shekalim 6:5', 'Eruvin 32a', 'Sotah 1:5', 'Kelim 1:8'], confidence: 'derived', note: 'She may drop the money in the chest, immerse, and eat sacred food that evening on the presumption that the kohanim offered her pair that day (Eruvin 32a). Petachyah was over the bird pairs (Shekalim 5:1).' },
      { id: 'amidah', label: 'She stands at the eastern gate while her offering is made', actors: [A('woman', 1, 'stand')], at: 'nikanor', props: [], animals: [], minutes: [5, 20], attire: ATTIRE.woman, sources: ['Sotah 1:5'], confidence: 'explicit', note: '"There they purify the yoledot" (Sotah 1:5).' },
      ...OFFERING_STEPS_LATER('chatat-haof', 'olat-haof')],
    frequency: { lo: 15, hi: 45, unit: 'women per weekday in Cheshvan',
      yields: { 'chatat-haof': 1, 'olat-haof': 0.85, olah: 0.15 }, yieldsNote: 'most mothers bring two birds, the rich a lamb olah and a bird chatat (Vayikra 12:6–8); the share of 15% with a lamb is reconstruction' },
    sources: ['Vayikra 12:6–8', 'Sotah 1:5', 'Keritot 1:7', 'Keritot 2:1', 'Shekalim 6:5', 'Eruvin 32a', 'Zevachim 10:4', 'Zevachim 89a–90a', 'Menachot 9:8'],
    notes: 'The chatat bird precedes the olah, even a lamb olah (Zevachim 89a–90a; Mishnah Zevachim 10:4); the verse names her olah first only in the reading (Rava, Zevachim 90a). Most mothers are poor enough to bring two birds; the rich add a lamb olah.',
  },
  'zav-zavah': {
    id: 'zav-zavah', names: { en: 'A zav or zavah on the eighth day', he: 'קרבן זב וזבה', translit: 'korban zav vezavah' },
    category: 'composite', form: 'set',
    components: [{ type: 'chatat-haof' }, { type: 'olat-haof' }],
    broughtBy: 'A man or woman healed of a flux, on the eighth day after seven clean days (Vayikra 15:13–15, 28–30)', occasions: ['the end of a flux'],
    slaughter: null, semichah: { required: false, words: null }, blood: { rite: 'per bird' }, burned: 'the olah bird', eaten: { by: 'male kohanim: the chatat bird' }, hide: null, nesachim: 'none',
    steps: [{ id: 'nikanor', label: 'The pair brought "before God, to the entrance" — at Nikanor', actors: [A('israelite', 1, 'stand', { note: 'a zav (or a woman, a zavah)' })], at: 'nikanor', props: ['basket'], animals: ['two birds'], minutes: [3, 10], attire: ATTIRE.owner, sources: ['Vayikra 15:14', 'Keritot 2:1', 'Kelim 1:8'], confidence: 'derived', note: 'Mechusar kippurim — he may not enter Ezrat Yisrael until they are offered (Kelim 1:8).' },
      ...OFFERING_STEPS_LATER('chatat-haof', 'olat-haof')],
    frequency: { lo: 2, hi: 10, unit: 'per weekday in Cheshvan', yields: { 'chatat-haof': 1, 'olat-haof': 1 } },
    sources: ['Vayikra 15:13–15', 'Vayikra 15:28–30', 'Keritot 1:7', 'Keritot 2:1', 'Kinnim 1:1'],
  },
  bikkurim: {
    id: 'bikkurim', names: { en: 'First fruits', he: 'ביכורים', translit: 'bikkurim' },
    category: 'gift', form: 'produce',
    produce: 'Of the seven species only (Bikkurim 1:3); in Cheshvan, choice olives and late dates or dried fruit',
    broughtBy: 'The landowner, who carries the basket himself from the Mount on (Bikkurim 3:4; Rambam Bikkurim 3:12)',
    occasions: ['from Shavuot to Sukkot with the declaration (Devarim 26:3–10); from Sukkot to Chanukah without it (Bikkurim 1:6)'],
    season: { recite: { from: { month: 3, day: 6 }, to: { month: 7, day: 14 } }, noRecite: { from: { month: 7, day: 15 }, to: { month: 9, day: 24 } }, sources: ['Bikkurim 1:3', 'Bikkurim 1:6'] },
    slaughter: null, semichah: { required: false, words: null }, blood: null,
    burned: 'nothing', eaten: { by: 'the kohanim (like terumah)' }, hide: null, nesachim: null,
    requires: 'a shelamim, song, waving and a night in Jerusalem (Bikkurim 2:4)',
    steps: [
      { id: 'aliyah', label: 'Basket on his shoulder from the Mount into the court; the Levites sing "I will exalt You"', actors: [OWNER('carry_shoulder_walk', { prop: 'basket' }), A('levi', 12, 'sing', { note: 'on the duchan — "Aromimcha" (Psalm 30:2) when the bikkurim reach the court (Bikkurim 3:4; Rambam Bikkurim 3:13)' })], at: ['nikanor', 'tenufah'], props: ['basket'], animals: ['birds tied to the basket, for olot (Bikkurim 3:5)'], minutes: [5, 10], attire: ATTIRE.owner, sources: ['Bikkurim 3:4', 'Bikkurim 3:5', 'Bikkurim 2:4', 'Rambam Bikkurim 3:12–13'], confidence: 'explicit', note: 'Whether a lone bringer in Cheshvan was met with the full song is not stated; 2:4 makes song a requirement of bikkurim.' },
      { ...tenufah('the basket'), actors: [OWNER('raise_hands_low', { prop: 'basket', gesture: 'tenufah' }), K(1, 'raise_hands_low', { gesture: 'tenufah' })], sources: ['Bikkurim 3:6', 'Menachot 61b'], confidence: 'explicit', note: 'In Cheshvan without the declaration (Bikkurim 1:6; R\' Yehudah ben Beteira: with it).' },
      { id: 'hanachah', label: 'Set down beside the altar, south of the SW horn; he bows and leaves', actors: [OWNER('bow')], at: 'altar-sw', props: ['basket'], animals: [], minutes: [1, 2], attire: ATTIRE.owner, sources: ['Bikkurim 3:6', 'Rambam Bikkurim 3:12'], confidence: 'explicit', note: 'The basket and fruit go to the kohen (Bikkurim 3:8).' }],
    frequency: { lo: 0, hi: 4, unit: 'baskets per weekday on 22 Cheshvan', note: 'inside the Sukkot–Chanukah season; none before Shavuot' },
    sources: ['Bikkurim 1:3', 'Bikkurim 1:6', 'Bikkurim 2:4', 'Bikkurim 3:2–8', 'Menachot 5:6', 'Menachot 61b', 'Rambam Bikkurim 3:12–13'],
    notes: 'The procession with the ox and the flute (Bikkurim 3:3) belongs to the companies of the ma\'amad in the main season; a lone bringer in Cheshvan comes without it (reconstruction).',
  },
};

/** the meal-offering pattern (Menachot 5–6; Zevachim 6:1–2; Rambam MK 12–13) */
function mealType(id, en, he, translit, prep, cooked) {
  return {
    id, names: { en, he, translit }, category: 'kodshei kodashim', form: 'meal',
    meal: { flour: 'at least an isaron (a tenth of an ephah) of fine wheat flour; up to 60 in one vessel (Menachot 13:1)', oil: id === 'minchat-chotei' ? 'none' : 'a log per isaron (Menachot 9:3)', levonah: id === 'minchat-chotei' ? 'none' : 'a handful (Menachot 13:3)', salt: 'yes (Vayikra 2:13)', prep },
    broughtBy: 'Usually the poor — "whose way is it to bring a meal-offering? the poor man\'s" (Menachot 104b); men or women; never in partnership (Menachot 104b)',
    occasions: ['a vow or a freewill gift (Menachot 13:1–2)'],
    slaughter: null, semichah: { required: false, words: null }, blood: null,
    burned: 'The kometz with all the frankincense (Rambam MK 13:12)', eaten: { by: 'male kohanim', where: 'within the court', until: 'that day and the night until midnight', sources: ['Zevachim 6:1', 'Menachot 6:1'] },
    hide: null, nesachim: null,
    steps: [
      { id: 'hava\'ah', label: 'Flour brought from home in a metal vessel and put into a service vessel', actors: [OWNER('carry_walk', { prop: 'bowl' })], at: ['nikanor', 'kemitzah'], props: ['bowl'], animals: [], minutes: [3, 6], attire: ATTIRE.owner, sources: ['Rambam MK 13:12', 'Rambam MK 12:23'], confidence: 'explicit', note: 'Ground and sifted outside; mixed, kneaded and baked inside the court (Rambam MK 12:23).' },
      ...(cooked ? [{ id: 'afiyah', label: 'Kneaded with warm water, fried or baked, broken into olive-sized pieces', actors: [K(1, 'kneel', { gesture: 'knead' })], at: 'kitchen', props: ['bowl'], animals: [], minutes: [20, 45], attire: ATTIRE.kohen, sources: ['Menachot 5:2', 'Menachot 6:4', 'Rambam MK 12:21–23', 'Rambam MK 13:6–8'], confidence: 'derived', note: 'Up to the taking of the handful a non-kohen may do the work (Rambam MK 12:23). The court\'s machavat, marcheshet and metal oven are service vessels (MK 12:23); where they stood is not recorded.' }] : []),
      { id: 'hagashah', label: 'Brought to the point of the SW horn', actors: [K(1, 'walk', { prop: 'bowl', gesture: 'touch-corner' })], at: 'hagashah', props: ['bowl'], animals: [], minutes: [0.5, 1], attire: ATTIRE.kohen, sources: ['Zevachim 6:2', 'Menachot 5:5', 'Rambam MK 13:12'], confidence: 'explicit' },
      { id: 'kemitzah', label: 'The handful taken, put in a vessel, salted', actors: [K(1, 'stand', { prop: 'bowl', gesture: 'kemitzah', note: 'the frankincense pushed aside; a full handful where the oil gathered (Rambam MK 13:12–13)' })], at: 'kemitzah', props: ['bowl'], animals: [], minutes: [1, 3], attire: ATTIRE.kohen, sources: ['Zevachim 6:1', 'Menachot 1:2', 'Rambam MK 13:12–14'], confidence: 'explicit', note: 'Standing on the floor, with the right hand (Menachot 1:2).' },
      { id: 'haktarah', label: 'The handful and the frankincense burned', actors: [K(1, 'carry_walk', { prop: 'bowl' })], at: ['melach', 'kevesh', 'maarachah'], props: ['bowl'], animals: [], minutes: [3, 5], attire: ATTIRE.kohen, sources: ['Rambam MK 13:12', 'Vayikra 2:2', 'Vayikra 2:13'], confidence: 'explicit' },
      eatKK('The remainder')],
    frequency: { lo: 2, hi: 8, unit: 'per weekday in Cheshvan' },
    sources: ['Zevachim 6:1–2', 'Menachot 5:3–9', 'Menachot 6:1–4', 'Menachot 13:1–3', 'Menachot 104b', 'Rambam MK 12:4', 'Rambam MK 13:5–14'],
  };
}

/** later steps of a composite set taken from its component types (by reference) */
function OFFERING_STEPS_LATER(...typeIds) {
  return typeIds.map((t) => ({ id: `component:${t}`, label: `Then the ${t.replace(/-/g, ' ')} as above`, ref: t, actors: [], at: [], props: [], animals: [], minutes: [0, 0], sources: [], confidence: 'derived' }));
}

// ======================================================================================== the day's rules
export const OFFERING_RULES = {
  window: {
    first: { spec: { at: 'sunrise', offset: 106 }, rule: 'Nothing is offered before the morning tamid — "and arrange the olah on it": the first olah of the day (Pesachim 58b). The model starts the stream when the morning tamid\'s libation and song are over, as schedule.js does.', sources: ['Pesachim 58b', 'Rambam TuM 1:3'], confidence: 'ordering' },
    lastSlaughter: { spec: { dayHour: 8.3 }, rule: 'Nothing is slaughtered after the afternoon tamid (Pesachim 58b, "on it complete all the offerings"; 59a; Rambam TuM 1:3, 1:6) — the tamid waits until 8½ hours precisely to leave the individuals two hours after midday (TuM 1:3). The model closes the stream a little before so the last blood is thrown before the tamid is slaughtered.', sources: ['Pesachim 58b', 'Pesachim 59a', 'Pesachim 5:1', 'Rambam TuM 1:3', 'Rambam TuM 1:6'], confidence: 'ordering' },
    exceptions: 'Only the incense, the lamps, the Pesach and the mechusar kippurim on the eve of Pesach come after the afternoon tamid (Pesachim 59a).',
    eimurimByDay: 'Fats should be burned before the afternoon tamid ("on it complete") — not deliberately delayed (Pesachim 59b; Rambam MK 4:3).',
  },
  night: {
    eimurim: { until: 'midnight', rule: 'Fats and limbs whose blood was thrown by day may be put on the fire all night (Megillah 2:6; Berachot 1:1); the Sages set midnight (Rambam MK 4:2; TuM 1:6).', sources: ['Megillah 2:6', 'Berachot 1:1', 'Rambam MK 4:2–3', 'Rambam TuM 1:6'] },
    turning: { until: 'dawn', rule: 'Limbs and fats not yet consumed — of the tamid or any offering — are turned all night until morning, "all night until the morning" (Vayikra 6:2; Rambam TuM 1:6). Who turned them and how often is not recorded.', sources: ['Rambam TuM 1:6', 'Vayikra 6:2'] },
    fallenLimbs: { rule: 'Limbs that spring off the altar before midnight are put back; after midnight not (Zevachim 9:6; Rambam MK 6:3).', sources: ['Zevachim 9:6', 'Rambam MK 6:3'] },
    eating: { until: 'midnight', rule: 'The most-holy meat and the remainder of meal-offerings: that day and the night until midnight, by male kohanim in the court (Zevachim 5:3, 5:5, 6:1; Rambam MK 10:8). Copper pots scoured and rinsed, earthenware broken, before the time runs out (Zevachim 11:7).', sources: ['Zevachim 5:3', 'Zevachim 11:4', 'Zevachim 11:7', 'Rambam MK 10:8'] },
    leftovers: { rule: 'Notar — meat left past its time — and disqualified offerings are burned BY DAY only, never at night, and not on Shabbat or a festival (Rambam Pesulei HaMukdashin 19:4–5; Pesachim 7:10); the most-holy in the court east of the ramp (Rambam MK 7:3; Zevachim 104b), the lesser by their owners at home (Pesulei HaMukdashin 19:7).', sources: ['Rambam Pesulei HaMukdashin 19:4–5', 'Rambam Pesulei HaMukdashin 19:7', 'Pesachim 7:10', 'Rambam MK 7:3', 'Zevachim 104b'] },
    clearing: 'Whatever is still unburned at dawn is pushed to the sides of the altar and returned to the new pile (Tamid 2:1, 2:5; Rambam TuM 2:5).',
  },
  shabbat: {
    individual: false,
    rule: 'Offerings of individuals do not override Shabbat; only those with a fixed time do (Temurah 2:1; Temurah 14a). No vows, gifts, chataot, ashamot, birds or meal-offerings of individuals on Shabbat.',
    fridayNight: 'Weekday fats are not burned on Shabbat: the tamid\'s "beginning" overrides Shabbat but its "end" does not, and "only on Friday" are Friday\'s limbs burned (Rambam TuM 1:7) — read by the Kesef Mishneh as "while it is still day, not on Friday night", following Rava (Yoma 46a); "not the olah of a weekday on Shabbat" (Pesachim 59b; Shabbat 24b). What could not be burned in time is raised to the altar top on Friday night but not put on the fire (Ritva on Yoma ch. 1, quoted in the Kesef Mishneh on TuM 1:7). The model therefore shows no tending of the pile on Friday night — the fire burns on by itself.',
    shabbatDay: 'Shabbat\'s own limbs and fats — of the temidim and the musaf — are put on the fire on Shabbat in their time, not left for Saturday night (Rambam MK 4:3); leftover limbs are arranged on a pile of their own "even on Shabbat" (R\' Meir, Yoma 46a).',
    saturdayNight: 'Shabbat\'s own limbs and fats burn on after Shabbat and may be turned (Rambam TuM 1:6–7).',
    sources: ['Temurah 2:1', 'Temurah 14a', 'Rambam TuM 1:7', 'Kesef Mishneh on Rambam TuM 1:7', 'Yoma 46a', 'Pesachim 59b', 'Shabbat 24b', 'Rambam MK 4:3'],
  },
  order: ['A chatat precedes the olah brought with it — even a bird chatat an animal olah (Zevachim 89a–90a; Mishnah Zevachim 10:2, 10:4)', 'Blood, then flaying, then the eimurim (Rambam MK 5:18)', 'Waving before the eimurim go up; the kohanim\'s portions only after (Rambam MK 9:11, 9:16)'],
  salt: 'Every offering is salted — limbs on the ramp, the kometz, the bird\'s head and body (Vayikra 2:13; Rambam MK 6:4; Zevachim 6:5); salt from Lishkat HaMelach (Middot 5:3).',
  nesachim: { table: NESACHIM, which: 'every olah and shelamim, and the metzora\'s chatat and asham; not bechor, ma\'aser, Pesach, chatat, asham (Menachot 9:6)', where: 'wine into the silver cup at the SW horn; the flour-and-oil burned whole (Zevachim 6:2; Menachot 6:2)', sources: ['Menachot 9:3', 'Menachot 9:6', 'Bamidbar 15:4–10', 'Report §65.1'] },
  hides: 'Hides of the most-holy go to the kohanim; salted in the Parvah; shared out to the beit av in the evening — later every Friday among both watches; the braita adds that at last the owners consecrated them (Pesachim 57a; Middot 5:3).',
  attire: ATTIRE,
  seasons: {
    bikkurim: 'From Shavuot to Sukkot with the declaration; from Sukkot to Chanukah without it (Bikkurim 1:6); never before Shavuot (1:3). 22 Cheshvan lies in the second season, so a late basket (olives, dates) is a fair sight but a rare one. schedule.js has no seasons, so its bikkurim event is reference-only; offeringWindows() opens a bikkurim lane by the Hebrew date. The festival week itself is counted with the second season (the Mishnah\'s "until the Festival" / "from the Festival" leaves it open).',
    maaser: 'Animal tithe is counted at three times — before Pesach, Shavuot and Sukkot (Bekhorot 9:5) — and mostly eaten at the festivals.',
  },
  lanes: {
    note: 'How many things can happen at once (the model\'s staging capacity; the sources give the fixtures, not the traffic).',
    slaughter: { capacity: 22, typical: [2, 6], at: 'rings', rule: '24 rings, the two tamid rings kept clear (Middot 3:5; Tamid 4:1)' },
    flaying: { capacity: 7, typical: [2, 5], at: 'nanasin', rule: '8 pillars with three rows of hooks each; the model stages 7 stations between them (Middot 3:5)' },
    rinsing: { capacity: 8, typical: [1, 3], at: 'marble-tables', rule: '8 marble tables (Shekalim 6:4) and the rinsers\' chamber (Middot 5:3)' },
    blood: { capacity: 3, typical: [1, 2], at: ['altar-ne', 'altar-sw', 'sovev'], rule: 'two corners for the two-that-are-four; one kohen on the sovev at a time for each chatat' },
    birds: { capacity: 3, typical: [1, 2], at: ['horn-se', 'altar-sw'], rule: 'olah birds at the SE (and at the SW above when many — Zevachim 6:2); chatat birds at the SW below' },
    meal: { capacity: 2, typical: [0, 1], at: ['kemitzah', 'hagashah'] },
    tenufah: { capacity: 2, typical: [0, 1], at: 'tenufah' },
    ramp: { capacity: 6, typical: [1, 4], at: ['kevesh', 'maarachah'], rule: 'carriers up the east side, down the west (Zevachim 6:3)' },
  },
  frequency: {
    day: 'an ordinary weekday in Cheshvan (22 Cheshvan, a month after Sukkot) — all numbers are reconstruction',
    perDay: {}, // filled below: [lo, hi] TOTAL per type, including what the sets bring
    sets: ['nazir', 'metzora', 'yoledet', 'zav-zavah'],
    alone: {}, // filled below: [lo, hi] per component type brought on its own (perDay minus the sets' yields)
    counting: 'perDay[type] is the day\'s TOTAL of that type, including the animals and birds that come inside the sets (nazir, metzora, yoledet, zav-zavah); a set\'s frequency.yields says how many of each component one set brings, on average. To stage a day, draw ONE day-level quantile q in [0, 1] (seeded by the date) and use lo + q·(hi − lo) everywhere: stage that many of each set with its components, then only alone[type] of each component type on its own. With one shared q the remainders are exact and never negative (tools/validate-schedule.mjs checks it). Nesachim are not drawn: they come with their animals (Menachot 9:6). Bikkurim birds (Bikkurim 3:5) are not counted.',
    basis: [
      'Bird pairs are the commonest sight: two of the thirteen chests were for bird money (Shekalim 6:5), an officer was over them (Shekalim 5:1), and demand from mothers and zavot once drove a pair to a gold dinar until Rabban Shimon ben Gamliel ruled that one pair covers five births (Keritot 1:7). Every birth ends in a pair (or a lamb and a bird); many were brought at the festivals, so a Cheshvan weekday gets a share.',
      'Vowed and freewill olot and shelamim are steady but modest away from the festivals; thanksgivings follow journeys and illnesses (Berachot 54b); chataot and ashamot depend on individual lapses and are fewer.',
      'Firstlings are brought within their first year, year-round; animal tithe clusters at the festivals (Bekhorot 9:5).',
      'Meal-offerings are the poor man\'s gift (Menachot 104b) — several a day.',
      'Capacity check: the window (~6½ hours in Cheshvan) at the lanes above holds far more than these numbers, so the courts are busy but not crowded — unlike the festivals.',
    ],
  },
};
{
  // totals, then the libations computed from their animals, then each component's remainder after the sets
  const F = OFFERING_RULES.frequency, T = OFFERING_TYPES, r1 = (x) => Math.round(x * 10) / 10;
  const n = T.nesachim.frequency;
  for (const end of ['lo', 'hi']) {
    n[end] = r1(n.withEach.reduce((s, id) => s + T[id].frequency[end], 0)
      + Object.entries(n.withSets).reduce((s, [set, comps]) => s + T[set].frequency[end] * comps.reduce((a, c) => a + (T[set].frequency.yields[c] || 0), 0), 0));
  }
  for (const [id, t] of Object.entries(T)) if (t.frequency) F.perDay[id] = [t.frequency.lo, t.frequency.hi];
  for (const [id, [lo, hi]] of Object.entries(F.perDay)) {
    if (F.sets.includes(id) || id === 'nesachim') continue;
    let a = lo, b = hi;
    for (const s of F.sets) { const y = T[s].frequency.yields[id] || 0; a -= y * T[s].frequency.lo; b -= y * T[s].frequency.hi; }
    F.alone[id] = [r1(a), r1(b)];
  }
}

/** Gestures, poses, props and animal variants the steps want that ctx.people does not have yet (requests). */
export const ASSET_NEEDS = {
  gestures: ['semichah (both hands on the head)', 'kabbalah (kneeling with the vessel under the neck)', 'finger (dipping and applying)', 'shefichah (pouring from the vessel against the yesod — firstling, tithe)', 'flay', 'melikah (bird held in the left hand, thumbnail at the nape)', 'tenufah (palms up, out and back, up and down)', 'kemitzah (handful)', 'knead', 'shave', 'eat (standing)', 'turn (tending the pile with a fork)'],
  props: ['tzinora (altar fork, Tamid 2:1)', 'salt basket', 'hide', 'bird basket / cage', 'loaf basket with 40 todah loaves', 'meal-offering vessel with flour and frankincense', 'machavat / marcheshet pan', 'copper cooking pot', 'razor', 'log of oil (small flask)'],
  animals: ['ewe lamb (female, no horns)', 'she-goat', 'kid', 'calf', 'cow', 'turtledove (grown)', 'young pigeon (before the yellow neck feathers, Chullin 1:5)'],
};

// ======================================================================================== windows of a civil date
const wrap = (t) => ((t % 1440) + 1440) % 1440;
/**
 * The offering-related windows of one civil date, in minutes after local midnight, each 0 ≤ t0 < t1 ≤ 1440.
 * dayType 'weekday' | 'friday' | 'shabbat' of the civil date; zmanim = ctx.time.zmanim ({ alot, sunrise, sunset,
 * midnight, shaahDay? }). opts.prevDayType — day type of the previous civil date (its night's tail is this date's
 * small hours; default: 'friday' before a 'shabbat', 'shabbat' before nothing known → 'weekday').
 * opts.hebrew — { month (Nisan = 1), day } of the daytime, to open the bikkurim lane in season.
 * Returns [{ id, t0, t1, offerings: [type ids], lanes: [lane ids], note, sources }].
 */
export function offeringWindows(dayType, zmanim, opts = {}) {
  const z = zmanim || {};
  if (![z.alot, z.sunrise, z.sunset].every(Number.isFinite)) return [];
  const shaah = Number.isFinite(z.shaahDay) ? z.shaahDay : (z.sunset - z.sunrise) / 12;
  const midnight = Number.isFinite(z.midnight) ? z.midnight : wrap(z.sunset + 6 * ((1440 - (z.sunset - z.sunrise)) / 12));
  const dayH = (h) => z.sunrise + h * shaah;
  const prev = opts.prevDayType || (dayType === 'shabbat' ? 'friday' : 'weekday');
  const out = [];
  const add = (id, a, b, offerings, lanes, note, sources) => {
    // split a window that runs past civil midnight; keep only the part on this date
    if (!(Number.isFinite(a) && Number.isFinite(b))) return;
    if (b < a) b += 1440;
    const t0 = Math.max(0, a), t1 = Math.min(1440, b);
    if (t1 > t0) out.push({ id, t0, t1, offerings, lanes, note, sources });
  };
  const DAILY = Object.keys(OFFERING_TYPES).filter((k) => k !== 'bikkurim');
  const nightMid = midnight < z.sunset ? midnight + 1440 : midnight; // this evening's midnight on a running clock
  const evStart = dayH(9.95);

  // the small hours belong to the previous night
  if (prev !== 'friday') {
    // weekday nights and Saturday night: limbs and fats still turned until the pre-dawn clearing
    add('turning', Math.max(0, midnight > 720 ? 0 : midnight), z.alot - 39, [], ['ramp'], 'limbs and fats turned on the pile until the clearing (Rambam TuM 1:6)', ['Rambam TuM 1:6', 'Tamid 2:1']);
  }

  if (dayType !== 'shabbat') {
    add('notar', z.sunrise + 106, z.sunrise + 136, ['chatat', 'asham'], ['blood'], 'yesterday\'s left-over most-holy meat burned by day in the court, east of the ramp', ['Rambam Pesulei HaMukdashin 19:4–5', 'Rambam MK 7:3']);
    const day = [...DAILY];
    const h = opts.hebrew;
    const inSeason = (h && OFFERING_TYPES.bikkurim.season) ? (() => {
      const md = (x) => x.month * 100 + x.day; const s = OFFERING_TYPES.bikkurim.season; const v = h.month * 100 + h.day;
      return (v >= md(s.recite.from) && v <= md(s.recite.to)) ? 'recite' : (v >= md(s.noRecite.from) && v <= md(s.noRecite.to)) ? 'no-recite' : null;
    })() : null;
    if (inSeason) day.push('bikkurim');
    add('individual', z.sunrise + 106, dayH(8.3), day, Object.keys(OFFERING_RULES.lanes).filter((k) => k !== 'note'),
      `individuals' offerings between the temidim${inSeason ? `; bikkurim in season (${inSeason === 'recite' ? 'with' : 'without'} the declaration)` : ''}`, ['Pesachim 58b', 'Pesachim 59a', 'Rambam TuM 1:3']);
    add('meal-day', dayH(3), dayH(8.3), ['chatat', 'asham', 'chatat-haof', 'minchat-solet', 'minchat-machavat', 'minchat-marcheshet', 'minchat-maafeh', 'minchat-chotei'], [], 'male kohanim eat the most-holy portions in the court', ['Zevachim 5:3']);
    // after the afternoon tamid: the day's last fats and limbs; on Friday only until sunset
    add('evening-burning', dayH(9.65), dayType === 'friday' ? z.sunset - 2 : nightMid, ['olah', 'chatat', 'asham', 'shelamim', 'todah', 'bechor'], ['ramp'],
      dayType === 'friday' ? 'the last fats and limbs on the fire before Shabbat (Rambam TuM 1:7 with Kesef Mishneh; Yoma 46a)' : 'the day\'s remaining fats and limbs on the fire until midnight; fallen limbs put back',
      dayType === 'friday' ? ['Rambam TuM 1:7', 'Kesef Mishneh on Rambam TuM 1:7', 'Yoma 46a', 'Pesachim 59b'] : ['Rambam MK 4:2–3', 'Rambam TuM 1:6', 'Zevachim 9:6', 'Pesachim 59b']);
    add('meal-evening', evStart, nightMid, ['chatat', 'asham', 'chatat-haof', 'minchat-solet'], [], 'the most-holy portions eaten until midnight', ['Zevachim 5:3', 'Rambam MK 10:8']);
    if (dayType === 'weekday') {
      add('scouring', nightMid - 40, nightMid, [], [], 'copper pots scoured and rinsed, earthenware broken, in the court', ['Zevachim 11:4', 'Zevachim 11:7']);
      add('turning', nightMid, 1440, [], ['ramp'], 'turning until the morning', ['Rambam TuM 1:6']);
    }
  } else {
    // Shabbat: no individuals; the tamid's and musafim's limbs are put on and arranged on Shabbat itself (MK 4:3),
    // then turned after Shabbat until midnight and beyond
    add('evening-burning', dayH(9.65), nightMid, [], ['ramp'], 'Shabbat\'s afternoon limbs put on the fire and arranged on Shabbat itself; tended after Shabbat', ['Rambam MK 4:3', 'Yoma 46a', 'Rambam TuM 1:6–7']);
    add('turning', nightMid, 1440, [], ['ramp'], 'turning until the morning (Saturday night)', ['Rambam TuM 1:6']);
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

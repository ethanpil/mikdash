// =============================================================================
// Mikdash — ZONE CONTENT  (src/data/zones-content.js, owner: schedule-data)
// =============================================================================
// What each named place of site.js is, who may enter it, what was done there, and where the sources say so
// (ARCHITECTURE.md §8). One entry for every zone id in SITE.zones: CANONICAL_ZONES plus the site-model sub-zones.
//
// Fields
//   name           { en, he, translit }
//   sanctity       0..10: the rung of Kelim 1:6–9 / Rambam BhB 7:12–22 (Report §0.5) on which the place stands,
//                  counted from 0 = Eretz Yisrael to 10 = Kodesh HaKodashim (SANCTITY_SCALE; Har HaBayit = 3).
//                  §0.5 numbers the same rungs from 1 (Har HaBayit 4, Heichal 10, the KhK "above all"); counting from 0
//                  lets the KhK keep a rung of its own inside 0..10. The UI reads either numbering (src/ui/data.js).
//   sanctityNote   why this rung, and where the sources leave it open (roofs, tunnels, half-and-half chambers)
//   access         who may and may not enter, and how one leaves (Kelim 1:6–9; Rambam BhB 7; Report §59)
//   services       what was done here, each line with its source (Report §60)
//   description    what the place is and looked like, its key dimensions in amot (site.js), what makes it notable
//   sources        citations for the entry
//   stand          [X, Y, Z] in site amot: a walkable observer spot inside the zone, checked so that
//                  zoneAtSite(X, Y, Z + 0.4) === id. Z picks the floor where levels stack (player goto.js);
//                  null where the zone has no walkable interior.
//   standHeading   optional compass heading (deg) to face on arriving at `stand`, where the place reads well from one
//                  side only (the Kodesh: its Menorah's lamps run east–west, so a view along the axis sees it edge-on).
//   confidence     how firmly the sources fix the place's footprint and position as modelled, in site.js's levels:
//                  'explicit' | 'derived' | 'locked' | 'reconstruction'; confidenceNote says what is not sourced.
//
// Times are given relative to the zmanim (cockcrow, first light, sunrise, seasonal hours), never as clock minutes.
// Where the sources disagree, the entry says so and names the reading the model shows (the Report's Part XI locks).
// =============================================================================
import { el, SITE } from './site.js';

// The landscape around the Mount is metre-native in site.js, so its stands depend on the amah standard.
const AX = SITE.axisY;                                         // 330.5 — the Temple axis
const Z_OPHEL = el('mount.gate.chuldah-w').box.min[2];          // Ophel grade at the Chuldah portals
const KIDRON = el('context.kidron').params;                     // thalweg X, Z
const PYRE = el('context.parah.pyre');                          // the Parah pyre on Har HaMishchah

/** The ten sanctities of Kelim 1:6–9 / Rambam BhB 7:12–22, counted from Eretz Yisrael (0) to the KhK (10). */
export const SANCTITY_SCALE = [
  { level: 0, en: 'Eretz Yisrael', he: 'ארץ ישראל', rule: 'Holier than all lands: the omer, the bikkurim and the two loaves come only from it', sources: ['Kelim 1:6', 'Rambam BhB 7:12'] },
  { level: 1, en: 'Walled cities', he: 'עיירות המוקפות חומה', rule: "Metzora'im are sent out of them", sources: ['Kelim 1:7', 'Rambam BhB 7:13'] },
  { level: 2, en: 'Jerusalem, within the wall', he: 'ירושלים', rule: "Kodashim kalim and ma'aser sheni are eaten there", sources: ['Kelim 1:8', 'Rambam BhB 7:14'] },
  { level: 3, en: 'Har HaBayit', he: 'הר הבית', rule: 'No zav, zavah, niddah or yoledet', sources: ['Kelim 1:8', 'Rambam BhB 7:15'] },
  { level: 4, en: 'The Chel', he: 'החיל', rule: 'No gentile, and no one impure from a corpse', sources: ['Kelim 1:8', 'Rambam BhB 7:16'] },
  { level: 5, en: 'Ezrat Nashim', he: 'עזרת נשים', rule: 'No tevul yom (by rabbinic decree)', sources: ['Kelim 1:8', 'Rambam BhB 7:17'] },
  { level: 6, en: 'Ezrat Yisrael', he: 'עזרת ישראל', rule: 'No mechusar kippurim; karet for one who enters impure', sources: ['Kelim 1:8', 'Rambam BhB 7:18'] },
  { level: 7, en: 'Ezrat Kohanim', he: 'עזרת כהנים', rule: 'Israelites only for semichah, slaughter and tenufah', sources: ['Kelim 1:8', 'Rambam BhB 7:19'] },
  { level: 8, en: 'Between the Ulam and the Mizbeach', he: 'בין האולם ולמזבח', rule: 'No kohen with a blemish or with grown hair', sources: ['Kelim 1:9', 'Rambam BhB 7:20'] },
  { level: 9, en: 'The Heichal', he: 'ההיכל', rule: 'None without washed hands and feet', sources: ['Kelim 1:9', 'Rambam BhB 7:21'] },
  { level: 10, en: 'Kodesh HaKodashim', he: 'קודש הקדשים', rule: 'The Kohen Gadol alone, on Yom Kippur, at the time of the service', sources: ['Kelim 1:9', 'Rambam BhB 7:22'] },
];

// shared wording
const ROOF_NOTE = "Roofs and upper storeys did not receive the sanctity of the court (Rambam BhB 6:7). The sources give such places no rung; this model shows them at Har HaBayit's, the precinct around them.";
const NIGHT_LEVITE = 'A Levite keeps watch here through the night (Middot 1:1; Rambam BhB 8:8)';
const COURT_GATE_ACCESS = "Into the court: kohanim for the service, Israelites with their own offerings (Kelim 1:8). The gateway, within the thickness of the wall, counts as inside the court (Rambam BhB 6:9); its outer stair goes down through the Chel.";

export const ZONE_CONTENT = {
  // ===== The city and the land around ======================================
  outside: {
    name: { en: 'Jerusalem, around the Temple Mount', he: 'ירושלים', translit: 'Yerushalayim' },
    sanctity: 2,
    sanctityNote: "Inside the city wall: kodashim kalim and ma'aser sheni are eaten here (Kelim 1:8; Rambam BhB 7:14). Beyond the wall only the sanctity of Eretz Yisrael applies.",
    access: "Open to all, but a metzora is sent out of a walled city (Kelim 1:7; Rambam BhB 7:13). No dead may be kept overnight in Jerusalem, and no graves stand in it except those of the House of David and of Chuldah the prophetess (Rambam BhB 7:14).",
    services: [
      "Kodashim kalim — shelamim, the todah, the Pesach — and ma'aser sheni are eaten anywhere within the wall (Kelim 1:8; Rambam BhB 7:14)",
      "At sunrise sparks fly from Queen Helena's golden nivreshet over the entrance of the Heichal, and the whole city knows the time for Shema has come (Yoma 37b)",
      "Gevini the crier calls “Kohanim, to your service! Levites, to your platform! Israelites, to your ma'amad!” — heard three parsaot away (Yoma 20b)",
      "Pesach night: “an olive's bulk of the Pesach, and the Hallel splits the roofs” (Pesachim 85b)",
    ],
    description: "The city that surrounded the Mount. The model shows it only as massing on the hills; the observer stands on the Ophel street at the foot of the southern wall, before the western Chuldah gate, where the public went in and out (Middot 1:3). The Mount's own floor stands about 13 m above this street in the model's approximate topography.",
    sources: ['Kelim 1:7–8', 'Rambam BhB 7:13–14', 'Middot 1:3', 'Yoma 20b', 'Yoma 37b', 'Pesachim 85b'],
    stand: [165, -15, Z_OPHEL],
    confidence: 'reconstruction',
    confidenceNote: 'City massing, streets and terrain are approximate real-world context in metres (site.js context.terrain), not sourced from the texts.',
  },

  kidron: {
    name: { en: 'Nachal Kidron', he: 'נחל קדרון', translit: 'Nachal Kidron' },
    sanctity: 0,
    sanctityNote: 'Outside the city wall: only the sanctity of Eretz Yisrael (Kelim 1:6). That the valley lay outside the wall is this model\'s assumption; the sources speak of the bloods "going out" to it (Middot 3:2).',
    access: 'No restriction of the Mikdash applies here.',
    services: [
      "The bloods poured on the altar's base run down the two holes at its south-western corner, mix in the amah channel and go out to Nachal Kidron (Middot 3:2)",
      "The blood-water is sold to gardeners as fertiliser, and using it without paying is me'ilah (Yoma 5:6)",
      'The Parah causeway crosses the valley on arches built over arches (Parah 3:6)',
    ],
    description: "The valley east of the Temple Mount, between its eastern wall and Har HaMishchah. In the model's approximate topography its bed runs about 200 m east of the wall and some 65 m below the Mount's pavement, falling to the south. The altar's drain empties here.",
    sources: ['Middot 3:2', 'Yoma 5:6', 'Yoma 58b', 'Parah 3:6'],
    stand: [KIDRON.thalwegX, AX - 50, KIDRON.thalwegZ],
    confidence: 'reconstruction',
    confidenceNote: 'Valley form and depth are approximate topography in metres (site.js context.kidron).',
  },

  'har-hamishchah': {
    name: { en: 'Har HaMishchah — the Mount of Olives', he: 'הר המשחה', translit: 'Har HaMishchah' },
    sanctity: 0,
    sanctityNote: 'The Parah Adumah is burned "outside the camp" (Bamidbar 19:3): beyond the city, with only the sanctity of Eretz Yisrael.',
    access: 'The kohen who burns the Parah, the Parah and all her attendants come out to it by the Eastern Gate and the causeway (Middot 1:3; Parah 3:6). The elders of Israel go ahead on foot (Parah 3:7).',
    services: [
      'The burning of the Parah Adumah: a pyre of cedar, pine, cypress and smooth fig wood, built like a tower with windows, its face to the west (Parah 3:8)',
      'The kohen stands east of the pyre facing west and sprinkles her blood seven times toward the Kodesh HaKodashim, aiming to see the entrance of the Heichal as he does (Parah 3:9; Middot 2:4)',
      'A house of immersion stands here (Parah 3:7)',
      'A third of the ashes is kept here, a third in the Chel, and a third is divided among the mishmarot (Parah 3:11)',
    ],
    description: "The ridge across the Kidron, facing the Temple's eastern gates. From its head the kohen burning the Parah looked straight down the Temple axis into the open doorway of the Heichal — the reason every eastern wall on that line was kept low (Middot 2:4; Rambam BhB 6:5). The model puts the burning place on the axis at the crest, about 800 m east of the Mount and 68 m above its pavement; the observer stands just behind the kohen's place.",
    sources: ['Middot 1:3', 'Middot 2:4', 'Parah 3:6–9', 'Parah 3:11', 'Rambam BhB 6:5', 'Bamidbar 19:3'],
    // site.js's daily viewpoint on the crest ground (params.groundEye); Z is the ground under that eye
    stand: [PYRE.params.groundEye[0], PYRE.params.groundEye[1], PYRE.params.groundEye[2] - (PYRE.params.kohenEye[2] - PYRE.params.kohenStand[2])],
    confidence: 'reconstruction',
    confidenceNote: 'The burning place on the axis at the crest and the terrain are approximate (site.js context.parah.pyre); the sources fix only "the head of Har HaMishchah" facing the Heichal.',
  },

  'parah-causeway': {
    name: { en: 'The Parah causeway', he: 'כבש הפרה', translit: 'Kevesh HaParah' },
    sanctity: 0,
    sanctityNote: 'Outside the Mount and the city wall: only the sanctity of Eretz Yisrael.',
    access: 'Built for the Parah: the kohen who burns her, the Parah and all her attendants go out over it to Har HaMishchah (Parah 3:6; Middot 1:3).',
    services: [
      'The procession of the Parah Adumah from the Eastern Gate to the burning place (Parah 3:6)',
      'It was paid for from the remainder of the chamber funds; Abba Shaul: the Kohanim Gedolim built it at their own cost (Shekalim 4:2)',
    ],
    description: "A bridge from Har HaBayit to Har HaMishchah, “arches upon arches, an arch over a pier”, so that no part of the way stood on ground that might cover a grave in the depths (Parah 3:6). The sources give its form but not its width, height or line; the model runs a level deck 10 amot wide on two tiers of arches from the threshold of the Eastern Gate across the Kidron, until the slope rises to meet it.",
    sources: ['Parah 3:6', 'Middot 1:3', 'Shekalim 4:2'],
    stand: [KIDRON.thalwegX, AX, 0],
    confidence: 'reconstruction',
    confidenceNote: 'Width, level deck and course are the model\'s (site.js context.parah-causeway); only the arch-over-pier form is sourced.',
  },

  // ===== Har HaBayit ========================================================
  'har-habayit': {
    name: { en: 'Har HaBayit — the Temple Mount', he: 'הר הבית', translit: 'Har HaBayit' },
    sanctity: 3,
    sanctityNote: 'No zav, zavah, niddah or yoledet (Kelim 1:8; Rambam BhB 7:15). Even a corpse may be carried onto the Mount, and certainly one impure from a corpse may enter (Rambam BhB 7:15).',
    access: "Closed to a zav, zavah, niddah and yoledet (Kelim 1:8), and to a ba'al keri until he has immersed (Devarim 23:11; Pesachim 68a; Rambam BhB 8:7). One comes only for a mitzvah, never with staff, shoes, money-belt or dust on the feet, never to spit, never as a shortcut (Berachot 9:5; Rambam BhB 7:2). Everyone enters by the right, goes round, and leaves by the left; one to whom something has happened goes round to the left. To a mourner they say, “May He who dwells in this House comfort you”; to one under a ban, “May He who dwells in this House put it in their hearts to bring you near” — so R. Meir; R. Yosi: “…put it in your heart to heed your fellows, and they will bring you near” (Middot 2:2). Gentiles, a tevul yom and one impure from a corpse may be here.",
    services: [
      "The circuit to the right on entering, and the mourner's circuit against it (Middot 2:2)",
      'The night watch: Levites at its five gates and at its four corners inside; the Ish Har HaBayit makes the rounds with torches and beats a guard he finds asleep (Middot 1:1–2)',
      'A court of twenty-three sits at the entrance of Har HaBayit (Sanhedrin 11:2)',
      "From 25 Adar the money-changers' tables for the half-shekel stand in the Mikdash (Shekalim 1:3)",
      'In the last forty years before the destruction the Great Sanhedrin left the Gazit and sat in the Chanut, "the stores", on Har HaBayit (Shabbat 15a; Sanhedrin 41a)',
      "On Yom Kippur the se'ir hamishtale'ach is led out over a ramp built for it, because Babylonians — R. Yehudah: Alexandrians — would pull its hair, crying “Take and go!” (Yoma 6:4; Yoma 66b); the ramp was paid for from the remainder of the chamber funds (Shekalim 4:2). Its course is not described",
    ],
    description: "A square of 500 by 500 amot within its walls (Middot 2:1), hollow beneath against a grave lying unknown in the deep (Parah 3:3) — built, says Rambam, on “arches upon arches” (BhB 5:1). The courts did not stand at its centre: its widest open ground lay to the south, then the east, then the north, least of all the west, “and where its measure was greatest, its use was greatest” (Middot 2:1). The sources give only that order; the margins here — south 258, east 100, north 97, west 63 amot — follow the commentary Ezrat Kohanim (on Middot 5:4).",
    sources: ['Middot 1:1–3', 'Middot 2:1–2', 'Parah 3:3', 'Kelim 1:8', 'Rambam BhB 5:1–2', 'Rambam BhB 5:6', 'Rambam BhB 7:2–3', 'Rambam BhB 7:15', 'Rambam BhB 8:7', 'Devarim 23:11', 'Pesachim 68a', 'Berachot 9:5', 'Sanhedrin 11:2', 'Shekalim 1:3', 'Shekalim 4:2', 'Shabbat 15a', 'Sanhedrin 41a', 'Yoma 6:4', 'Yoma 66b', 'Ezrat Kohanim on Middot 5:4'],
    stand: [445, AX, 0],
    confidence: 'locked',
    confidenceNote: 'The 500 × 500 is explicit; the margins follow the commentary Ezrat Kohanim (on Middot 5:4), since the Mishnah gives only their order.',
  },

  stoa: {
    name: { en: 'The double colonnades', he: 'סטיו לפנים מסטיו', translit: 'Stav lifnim mistav' },
    sanctity: 3,
    sanctityNote: "Part of Har HaBayit, with its rung.",
    access: 'As Har HaBayit.',
    services: [
      'A new parochet is spread on the roof of the itztaba so that the people can see its fine work (Shekalim 8:4)',
      'When the first day of Sukkot fell on Shabbat, the people brought their lulavim on Friday and the attendants laid them out on the itztaba (Sukkah 4:4)',
    ],
    description: "“The whole of it was roofed, colonnade within colonnade” (Rambam BhB 5:1): a double portico ran round the inside of the Mount's walls. The itztaba of Shekalim 8:4 and Sukkah 4:4 is taken here as this colonnade, for the Gemara follows them with “Har HaBayit was a double stoa” (Sukkah 45a). No depth or height is given; the model has two aisles of 10 amot under a flat roof 20 amot high, kept below the low eastern wall so the view from Har HaMishchah stays open.",
    sources: ['Rambam BhB 5:1', 'Shekalim 8:4', 'Sukkah 4:4', 'Sukkah 45a'],
    stand: [250, 5, 0],
    confidence: 'reconstruction',
    confidenceNote: 'Depth, height and column spacing are unsourced; the Josephus-derived royal stoa is not used.',
  },

  chel: {
    name: { en: 'The Chel', he: 'החיל', translit: 'Chel' },
    sanctity: 4,
    sanctityNote: 'Closed to gentiles and to anyone impure from a corpse (Kelim 1:8); Rambam adds one who had relations with a niddah (BhB 7:16). With Ezrat Nashim it is "an added degree" beyond the Levite camp (Rambam BhB 7:11).',
    access: 'No gentile, and no one impure from a corpse until he has been sprinkled and has immersed (Kelim 1:8). Rambam adds one who had relations with a niddah (BhB 7:16).',
    services: [
      'The thirteen prostrations opposite the thirteen breaches that the Greek kings made in the soreg and that were fenced again (Middot 2:3)',
      'On Shabbat and festivals the courts sat here (Sanhedrin 88b)',
      'A third of the ashes of every Parah Adumah is kept here (Parah 3:11)',
      'A parochet defiled by a major impurity is immersed outside and spread here to dry (Shekalim 8:4)',
      'When erev Pesach fell on Shabbat, the second group sat here with their offerings until nightfall (Pesachim 5:10)',
    ],
    description: "The strip of ten amot inside the soreg, round the walls of the courts (Middot 2:3). On the east the twelve steps of the Chel, each half an amah high and half an amah deep, climb six amot to the gate of Ezrat Nashim (Middot 2:3; Rambam BhB 6:1). Rambam reads “the Chel, ten amot” as a wall ten amot high (BhB 5:3, on Eichah 2:8); the model follows the plain Mishnah as Bartenura explains it — an open space of ten amot inside the soreg — with the soreg at its outer edge, as the commentary Ezrat Kohanim draws it.",
    sources: ['Middot 2:3', 'Kelim 1:8', 'Rambam BhB 5:3', 'Rambam BhB 6:1', 'Rambam BhB 7:11', 'Rambam BhB 7:16', 'Sanhedrin 88b', 'Parah 3:11', 'Shekalim 8:4', 'Pesachim 5:10', 'Bartenura on Middot 2:3', 'Ezrat Kohanim on Middot 2:3'],
    stand: [407, 312, 0],
    confidence: 'locked',
    confidenceNote: "Width 10 explicit; the strip with the soreg on its outer line follows Bartenura and the commentary Ezrat Kohanim (on Middot 2:3). On the north and south the court gates' stairs cross it — the 16-amah drop from the court forces them; no source describes them.",
  },

  soreg: {
    name: { en: 'The Soreg', he: 'הסורג', translit: 'Soreg' },
    sanctity: 3,
    sanctityNote: "The fence is the Chel's outer edge: on this side, Har HaBayit; past it, the Chel's rung.",
    access: 'Gentiles and those impure from a corpse go no further than this fence (Kelim 1:8; Middot 2:3).',
    services: [
      'Thirteen breaches made by the Greek kings were fenced again, and thirteen prostrations were decreed opposite them (Middot 2:3) — the view the model shows',
      'The other view sets the thirteen prostrations in the court, opposite its thirteen gates: four north, four south, three east, two west (Shekalim 6:3; Abba Yosi ben Chanan in Middot 2:6)',
      'The houses of Rabban Gamliel and of R. Chananya, Segan HaKohanim, bowed a fourteenth time, toward the wood chamber (Shekalim 6:1)',
    ],
    description: "A lattice fence ten tefachim high, ringing the sacred precinct inside the Mount (Middot 2:3; Rambam BhB 5:3), its slats crossed diagonally “like a bed laced with cords” (Bartenura on Middot 2:3). The model stands it on a one-amah stone base at the outer line of the Chel, after the commentary Ezrat Kohanim (on Middot 2:3); Rambam, the Rosh and Shiltei HaGiborim set it apart from the Chel, nearer the Mount's walls. The observer stands where the main way passes through it, on the axis before the Chel steps.",
    sources: ['Middot 2:3', 'Middot 2:6', 'Shekalim 6:1', 'Shekalim 6:3', 'Kelim 1:8', 'Rambam BhB 5:3', 'Bartenura on Middot 2:3', 'Ezrat Kohanim on Middot 2:3'],
    stand: [410, AX, 0],
    confidence: 'locked',
    confidenceNote: "Height explicit; its line follows the commentary Ezrat Kohanim (on Middot 2:3). Middot 2:3 gives the breaches no positions: the model's thirteen stations are reconstruction, spread evenly along the sides with the gates view's counts (4 north, 4 south, 3 east, 2 west — Shekalim 6:3) and kept clear of the gates' stairs (site.js).",
  },

  'gate-shushan': {
    name: { en: "Sha'ar Shushan — the Eastern Gate", he: 'שער המזרח', translit: "Sha'ar HaMizrach" },
    sanctity: 3,
    sanctityNote: 'A gate of Har HaBayit, with its rung.',
    access: "As Har HaBayit. Through it the kohen who burns the Parah, the Parah and all her attendants go out to Har HaMishchah (Middot 1:3).",
    services: [
      'The Parah procession leaves by it for Har HaMishchah (Middot 1:3)',
      NIGHT_LEVITE,
      'The wall over it was kept low, so that the kohen on Har HaMishchah could see the entrance of the Heichal (Middot 2:4; Rambam BhB 6:5)',
    ],
    description: "The eastern gate of the Mount, 10 amot wide and 20 high, with “Shushan the capital” pictured on it (Middot 1:3; 2:3). It stands on the Temple axis, its threshold the datum from which the model's heights are measured; the Heichal's floor is 22 amot above it, higher than the gate, which is why the wall above the gate had to be low (Rambam BhB 6:5). Its doors, like every gate's but Nikanor's, were plated with gold (Middot 2:3).",
    sources: ['Middot 1:1', 'Middot 1:3', 'Middot 2:3–4', 'Rambam BhB 6:5', 'Ezrat Kohanim on Middot 1:9'],
    stand: [502.5, AX, 0],
    confidence: 'locked',
    confidenceNote: 'Size explicit; its place on the axis follows the commentary Ezrat Kohanim (on Middot 1:9).',
  },

  'gate-chuldah-w': {
    name: { en: "Sha'ar Chuldah — western", he: 'שער חולדה', translit: "Sha'ar Chuldah" },
    sanctity: 2,
    sanctityNote: "The passage runs under the Mount, and passages under it that open to Har HaBayit were not sanctified (Rambam BhB 6:9) — so much so that a kohen made impure in the night, who may not stay on the Mount, could walk the one under the Birah (Rambam BhB 8:7). Shown at Jerusalem's rung; the Mount's begins where the stair comes up onto the pavement.",
    access: 'The main public way in and out of Har HaBayit (Middot 1:3). On reaching the Mount everyone turns to the right and goes round (Middot 2:2).',
    services: ['Entry and exit for the public (Middot 1:3)', NIGHT_LEVITE],
    description: "The two Chuldah gates in the southern wall “served for entry and exit” (Middot 1:3), on the side of the Mount's greatest open ground (Middot 2:1). The gates trisect the southern wall, 160 amot apart (the commentary Ezrat Kohanim on Middot 1:9). In the model each opens from the Ophel street into a level passage under the vaults and a stair rising north onto the Mount; the passage is reconstructed from the real fall of the ground, about 13 m.",
    sources: ['Middot 1:1', 'Middot 1:3', 'Middot 2:1–3', 'Rambam BhB 6:9', 'Rambam BhB 8:7', 'Ezrat Kohanim on Middot 1:9'],
    stand: [165, 20, Z_OPHEL],
    confidence: 'reconstruction',
    confidenceNote: 'Gate stations follow the commentary Ezrat Kohanim (on Middot 1:9); the passage, its depth and stair are reconstruction from approximate topography.',
  },

  'gate-chuldah-e': {
    name: { en: "Sha'ar Chuldah — eastern", he: 'שער חולדה', translit: "Sha'ar Chuldah" },
    sanctity: 2,
    sanctityNote: "As the western Chuldah passage: passages under the Mount opening to Har HaBayit were not sanctified (Rambam BhB 6:9; 8:7). Shown at Jerusalem's rung.",
    access: 'The main public way in and out of Har HaBayit (Middot 1:3). On reaching the Mount everyone turns to the right and goes round (Middot 2:2).',
    services: ['Entry and exit for the public (Middot 1:3)', NIGHT_LEVITE],
    description: "The second of the two southern gates that “served for entry and exit” (Middot 1:3), 10 amot wide and 20 high with gold-plated doors (Middot 2:3). It stands 160 amot from the south-eastern corner (the commentary Ezrat Kohanim on Middot 1:9). As with its twin, the passage and stair under the Mount are reconstruction.",
    sources: ['Middot 1:1', 'Middot 1:3', 'Middot 2:3', 'Rambam BhB 6:9', 'Rambam BhB 8:7', 'Ezrat Kohanim on Middot 1:9'],
    stand: [335, 20, Z_OPHEL],
    confidence: 'reconstruction',
    confidenceNote: 'Gate station after the commentary Ezrat Kohanim (on Middot 1:9); passage and stair reconstruction.',
  },

  'gate-kiponus': {
    name: { en: "Sha'ar Kiponus — the western gate", he: 'שער קיפונוס', translit: "Sha'ar Kiponus" },
    sanctity: 3,
    sanctityNote: 'A gate of Har HaBayit, with its rung.',
    access: 'As Har HaBayit. It "served for entry and exit" (Middot 1:3).',
    services: ['Entry and exit from the west (Middot 1:3)', NIGHT_LEVITE],
    description: "The one gate in the western wall, “serving entry and exit” (Middot 1:3), 10 amot wide and 20 high with gold-plated doors (Middot 2:3). The west was the Mount's narrowest margin (Middot 2:1). The model sets it at the middle of the wall, after the commentary Ezrat Kohanim (on Middot 1:9); the way up to it from the city is not described.",
    sources: ['Middot 1:1', 'Middot 1:3', 'Middot 2:1', 'Middot 2:3', 'Ezrat Kohanim on Middot 1:9'],
    stand: [-2.5, 250, 0],
    confidence: 'locked',
    confidenceNote: 'Size explicit; station after the commentary Ezrat Kohanim (on Middot 1:9).',
  },

  'gate-tadi': {
    name: { en: "Sha'ar Tadi — the northern gate", he: 'שער טדי', translit: "Sha'ar Tadi" },
    sanctity: 3,
    sanctityNote: 'A gate of Har HaBayit, with its rung.',
    access: '"It served no purpose" (Middot 1:3). R. Eliezer ben Yaakov: a kohen made impure in the night went out through the passage under the Chel and left by Tadi (Middot 1:9).',
    services: [
      'No public use (Middot 1:3)',
      NIGHT_LEVITE,
      'R. Eliezer ben Yaakov: the night-impure kohen goes out by it; the anonymous Mishnah sends him to the Beit HaTevilah under the Birah to wait for the gates to open, and the model follows that (Middot 1:9; Tamid 1:1)',
    ],
    description: "The northern gate of the Mount, 10 amot wide and 20 high (Middot 2:3). Every gate had a flat lintel except Tadi, whose head was “two stones leaning one on the other” — a pointed top (Middot 2:3). The model places it opposite the gate of Beit HaMoked, after the commentary Ezrat Kohanim (on Middot 1:9).",
    sources: ['Middot 1:1', 'Middot 1:3', 'Middot 1:9', 'Middot 2:3', 'Tamid 1:1', 'Ezrat Kohanim on Middot 1:9'],
    stand: [210.75, 502.5, 0],
    confidence: 'locked',
    confidenceNote: 'Size and head explicit; station after the commentary Ezrat Kohanim (on Middot 1:9).',
  },

  'shushan-habirah': {
    name: { en: 'Shushan HaBirah — the chamber over the Eastern Gate', he: 'שושן הבירה', translit: 'Shushan HaBirah' },
    sanctity: 3,
    sanctityNote: ROOF_NOTE,
    access: 'Not described in the sources. The model reaches it from the roof of the east colonnade.',
    services: [
      "Two standard amot were kept here: the north-eastern longer than Moshe's amah by half an etzba, the south-eastern by a whole etzba (Kelim 17:9; Menachot 98a)",
      "Craftsmen took work by the smaller measure and delivered by the larger, “so that they should not come to me'ilah” (Kelim 17:9)",
    ],
    description: "The Eastern Gate bore a picture of Shushan the capital (Middot 1:3). Kelim 17:9 keeps the two standard amot “in Shushan HaBirah”, and the commentary Ezrat Kohanim places them in a chamber over the gate (on Middot 1:9). The model gives it a small room within the wall over the gate, its roof no higher than the low eastern walls so it does not block the view from Har HaMishchah.",
    sources: ['Middot 1:3', 'Kelim 17:9', 'Menachot 98a', 'Ezrat Kohanim on Middot 1:9'],
    stand: [502.5, AX, 22],
    confidence: 'reconstruction',
    confidenceNote: 'Existence as a chamber over the gate follows the commentary Ezrat Kohanim (on Middot 1:9); size, height and access are the model\'s.',
  },

  'lishkat-hakorban': {
    name: { en: 'Lishkat HaKorban — the chamber of the offering', he: 'לשכת הקרבן', translit: 'Lishkat HaKorban' },
    sanctity: 3,
    sanctityNote: 'Placed on Har HaBayit in this model, with its rung.',
    access: 'As Har HaBayit. A Levite guards it at night (Middot 1:1).',
    services: [
      "One of the Levites' twenty-one night posts (Middot 1:1; Rambam BhB 8:9)",
      'Its use is not described; the name suggests a store for the offerings (reconstruction)',
    ],
    description: "Named only in the list of the night watch (Middot 1:1). The model places it on the Mount just outside the soreg, beside the foot of the stair of Sha'ar HaKorban, because the Levites kept watch outside the court (Rambam BhB 8:4; 8:8).",
    sources: ['Middot 1:1', 'Rambam BhB 8:4', 'Rambam BhB 8:8–9', 'Reconstruction (model)'],
    stand: [174.5, 425, 0],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint and place unsourced (a nominal box).',
  },

  'lishkat-haparochet': {
    name: { en: 'Lishkat HaParochet — the chamber of the curtain', he: 'לשכת הפרוכת', translit: 'Lishkat HaParochet' },
    sanctity: 3,
    sanctityNote: 'Placed on Har HaBayit in this model, with its rung.',
    access: 'As Har HaBayit. A Levite guards it at night (Middot 1:1).',
    services: [
      "One of the Levites' twenty-one night posts (Middot 1:1; Rambam BhB 8:9)",
      'Elazar was the officer over the parochot (Shekalim 5:1); two were made every year, each 40 amot by 20 and a tefach thick, woven on 72 cords of 24 threads (Shekalim 8:5)',
      'The women who wove the parochot were paid from the Temple funds (Ketubot 106a)',
    ],
    description: "Like Lishkat HaKorban, it is named only as a night post (Middot 1:1); its tie to the making and keeping of the curtains is read from its name (reconstruction). The model places it on the Mount, opposite Lishkat HaKorban at the foot of the Korban gate's stair, where the women weavers could come.",
    sources: ['Middot 1:1', 'Shekalim 5:1', 'Shekalim 8:5', 'Ketubot 106a', 'Rambam BhB 8:9', 'Reconstruction (model)'],
    stand: [148.5, 425, 0],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint, place and use as a weaving workshop are unsourced (a nominal box).',
  },

  'beit-haeven': {
    name: { en: 'Lishkat Beit HaEven — the Stone House', he: 'לשכת בית האבן', translit: 'Beit HaEven' },
    sanctity: 3,
    sanctityNote: 'Placed on Har HaBayit in this model, with its rung.',
    access: 'The kohen who will burn the Parah Adumah, set apart here seven days before the burning (Parah 3:1).',
    services: [
      "Seven days before the burning the kohen is moved from his house to this chamber and sprinkled every day with the ashes of the earlier Parot; R. Yosi: only on the third and seventh days (Parah 3:1)",
      'It was called the Stone House because everything done in it used vessels of dung, stone and earth, which do not take impurity (Yoma 2a)',
    ],
    description: "“The chamber facing the Birah, to the north-east” (Parah 3:1). The model sets it on the Mount north-east of the courts, its door facing north toward the Birah; where the Birah itself stood is an open question (Yoma 2a).",
    sources: ['Parah 3:1', 'Yoma 2a'],
    stand: [375, 442, 0],
    confidence: 'reconstruction',
    confidenceNote: 'North-east is explicit; footprint and exact place are the model\'s.',
  },

  // ===== Ezrat Nashim =======================================================
  'ezrat-nashim': {
    name: { en: "Ezrat Nashim — the Women's Court", he: 'עזרת הנשים', translit: 'Ezrat Nashim' },
    sanctity: 5,
    sanctityNote: 'Closed to a tevul yom by rabbinic decree; one impure from a corpse who enters brings no chatat for it (Kelim 1:8; Rambam BhB 7:17).',
    access: 'Men and women alike. No tevul yom — one who has immersed and waits for sunset — by rabbinic decree (Rambam BhB 7:17). One who becomes impure inside leaves by the shortest way (Shevuot 2:3).',
    services: [
      'Simchat Beit HaShoeivah on the nights of Sukkot: golden menorot 50 amot high, the pious dancing with torches, the Levites playing on the fifteen steps (Sukkah 5:2–4; Sukkah 52b)',
      'On Yom Kippur the Kohen Gadol reads the Torah, in his linen garments or, if he prefers, in his own white robe (Yoma 7:1); "in the court" — Rav Chisda: in Ezrat Nashim (Yoma 69b)',
      'Hakhel: the Mishnah says the king read "in the court"; Rambam places it in Ezrat Nashim (Sotah 7:8; Rambam Chagigah 3:4)',
      "Its four corner chambers serve the nazirites, the wood, the metzora'im, and wine and oil (Middot 2:5)",
      'The thirteen shofarot: chests narrow at the mouth and widening below, like a shofar, each written with what it takes — new shekels, old shekels, kinnin (bird pairs), gozlei olah (birds all for olot), wood, frankincense, gold for the kaporet, and six for nedavah, free-will money bought as olot (Shekalim 6:1, 6:5–6; Bartenura on Shekalim 2:1)',
      'A yoledet puts the money for her birds into the kinnin chest, and may eat of sacred food that evening, on the presumption that the kohanim offered her pair that day (Eruvin 32a)',
      'A court of twenty-three sits "at the entrance of the Azarah" (Sanhedrin 11:2) — commonly placed at the entry of Ezrat Nashim or before Sha\'ar Nikanor (reconstruction)',
    ],
    description: "A square court of 135 by 135 amot east of the Azarah, its floor 6 amot above the Mount (Middot 2:5; Rambam BhB 6:1). Four unroofed chambers of 40 by 40 amot filled its corners (Middot 2:5). It was at first flat; a gallery was built round it so that the women watched from above and the men from below and did not mingle (Middot 2:5) — the Gemara ties this to the levity of Simchat Beit HaShoeivah (Sukkah 51b). On its west the fifteen rounded steps climb to Sha'ar Nikanor. Near their foot, north of the way up, the model sets the thirteen shofarot in a ring, in the Mishnah's order (Shekalim 6:5). The Mishnah says only that they were in the Mikdash (Shekalim 6:1); they are placed here because the kinnin chest must be within a yoledet's reach, and she may not pass into Ezrat Yisrael before her offering (Kelim 1:8).",
    sources: ['Middot 2:5', 'Kelim 1:8', 'Rambam BhB 5:7–9', 'Rambam BhB 6:1', 'Rambam BhB 7:17', 'Sukkah 5:2–4', 'Sukkah 51b', 'Yoma 7:1', 'Yoma 69b', 'Sotah 7:8', 'Sanhedrin 11:2', 'Shevuot 2:3', 'Shekalim 6:1', 'Shekalim 6:5–6', 'Bartenura on Shekalim 2:1', 'Eruvin 32a'],
    stand: [345, AX, 6],
    confidence: 'explicit',
  },

  'en-gate-east': {
    name: { en: 'The east gate of Ezrat Nashim', he: 'השער היוצא למזרח', translit: 'HaSha\'ar HaYotze LaMizrach' },
    sanctity: 5,
    sanctityNote: "The court's own gate, at its rung.",
    access: 'The way in from the Chel, up the twelve steps to its threshold. No tevul yom beyond it (Rambam BhB 7:17).',
    services: [
      'At cockcrow on Sukkot two kohanim with trumpets come down from the upper gate, sounding as they go, until they reach "the gate that goes out to the east"; there they turn to face west and say: "Our fathers in this place had their backs to the Heichal… but we — our eyes are to Kah" (Sukkah 5:4)',
      'The line of sight from Har HaMishchah to the Heichal passes over this gate; the eastern walls were kept low for it (Middot 2:4)',
    ],
    description: "The only gate of Ezrat Nashim that the sources name — “the gate that goes out to the east” (Sukkah 5:4) — on the Temple axis at the head of the Chel steps, 20 amot high and 10 wide (Middot 2:3). Gates on the north and south of this court appear only in the thirteen-gate lists and are not built here.",
    sources: ['Sukkah 5:4', 'Middot 2:3', 'Middot 2:4', 'Middot 2:6'],
    stand: [397.5, AX, 6],
    confidence: 'derived',
    confidenceNote: 'On the axis at the head of the Chel steps, as the ascent requires.',
  },

  'en-chamber-wood': {
    name: { en: 'Lishkat HaEtzim — the wood chamber', he: 'לשכת העצים', translit: 'Lishkat HaEtzim (Dir HaEtzim)' },
    sanctity: 5,
    sanctityNote: 'A corner chamber of Ezrat Nashim, open to the sky; the sources give it no rung apart from the court.',
    access: 'Kohanim with blemishes, who may not serve at the altar, work here (Middot 2:5).',
    services: [
      'Blemished kohanim pick over the firewood for worms; any log with a worm in it is unfit for the altar (Middot 2:5)',
      'The houses of Rabban Gamliel and of R. Chananya, Segan HaKohanim, bowed a fourteenth time toward it, by a family tradition that the Aron was hidden here (Shekalim 6:1)',
      'A kohen at work once saw that one paving stone differed from the rest; he died before he could finish telling it (Shekalim 6:2)',
    ],
    description: "The north-eastern corner chamber of Ezrat Nashim, 40 by 40 amot and unroofed (Middot 2:5). Firewood for the altar was checked here. On the Aron the sources differ: Shekalim 6:1–2 points here; others say it went to Bavel or was hidden in its place beneath the Kodesh HaKodashim (Yoma 53b–54a), and Rambam says Yoshiyahu hid it in vaults Shlomo had built (BhB 4:1). The model shows one paving stone of a different marble, nothing more.",
    sources: ['Middot 2:5', 'Shekalim 6:1–2', 'Yoma 53b–54a', 'Rambam BhB 4:1', 'Rambam BhB 5:8'],
    stand: [375, 378, 6],
    confidence: 'explicit',
    confidenceNote: 'Size, corner and open roof explicit (Middot 2:5); inner walls, height and door are the model\'s.',
  },

  'en-chamber-lepers': {
    name: { en: "Lishkat HaMetzora'im — the chamber of the lepers", he: 'לשכת המצורעים', translit: "Lishkat HaMetzora'im" },
    sanctity: 5,
    sanctityNote: 'A corner chamber of Ezrat Nashim, open to the sky; the sources give it no rung apart from the court.',
    access: "Healed metzora'im on the eighth day of their purification (Middot 2:5).",
    services: [
      "The healed metzora immerses here on his eighth day, then stands in Sha'ar Nikanor for the blood and oil (Middot 2:5; Yoma 30b)",
    ],
    description: "The north-western corner chamber of Ezrat Nashim, 40 by 40 amot and unroofed (Middot 2:5). A metzora whose seven days were counted immersed here on the eighth and went up to stand in the gate of Nikanor, where the blood and oil were put on his right ear, thumb and toe (Yoma 30b; Vayikra 14:14). The mikveh in the model takes the measure of Yoma 31a: an amah by an amah, three amot deep.",
    sources: ['Middot 2:5', 'Yoma 30b', 'Yoma 31a', 'Vayikra 14:14', 'Rambam BhB 5:8'],
    stand: [280, 378, 6],
    confidence: 'explicit',
    confidenceNote: 'Size, corner and open roof explicit (Middot 2:5); the mikveh\'s form and the chamber\'s walls and door are the model\'s.',
  },

  'en-chamber-nazirites': {
    name: { en: 'Lishkat HaNezirim — the chamber of the nazirites', he: 'לשכת הנזירים', translit: 'Lishkat HaNezirim' },
    sanctity: 5,
    sanctityNote: 'A corner chamber of Ezrat Nashim, open to the sky; the sources give it no rung apart from the court.',
    access: 'Nazirites who have completed their vow, with their offerings (Middot 2:5).',
    services: [
      'A nazir at the end of his vow cooks his shelamim here, shaves his hair and throws it into the fire under the pot (Middot 2:5; Bamidbar 6:18)',
    ],
    description: "The south-eastern corner chamber of Ezrat Nashim, 40 by 40 amot and unroofed (Middot 2:5). Here a nazir who had finished his term cooked the meat of his peace-offering, shaved his head, and cast the hair into the fire beneath the pot — the Torah's “on the fire that is under the shelamim” (Bamidbar 6:18).",
    sources: ['Middot 2:5', 'Bamidbar 6:18', 'Rambam BhB 5:8'],
    stand: [375, 285, 6],
    confidence: 'explicit',
    confidenceNote: 'Size, corner and open roof explicit (Middot 2:5); walls and door are the model\'s.',
  },

  'en-chamber-oil': {
    name: { en: 'Lishkat Beit Shemanya — the chamber of oils', he: 'לשכת בית שמניה', translit: 'Lishkat Beit Shemanya' },
    sanctity: 5,
    sanctityNote: 'A corner chamber of Ezrat Nashim, open to the sky; the sources give it no rung apart from the court.',
    access: 'A store of the court.',
    services: ['Wine and oil are kept here (Abba Shaul, Middot 2:5)'],
    description: "The south-western corner chamber of Ezrat Nashim, 40 by 40 amot and unroofed (Middot 2:5). R. Eliezer ben Yaakov, the Mishnah's eyewitness, said “I have forgotten what it served”; Abba Shaul said wine and oil were put there and it was called the chamber of Beit Shemanya (Middot 2:5). Rambam and the model follow Abba Shaul (BhB 5:8).",
    sources: ['Middot 2:5', 'Rambam BhB 5:8'],
    stand: [280, 285, 6],
    confidence: 'explicit',
    confidenceNote: 'Size, corner and open roof explicit (Middot 2:5); walls and door are the model\'s.',
  },

  'en-gallery': {
    name: { en: "The gezuztra — the women's gallery", he: 'גזוזטרא', translit: 'Gezuztra' },
    sanctity: 5,
    sanctityNote: "A balcony over Ezrat Nashim; the sources give it no rung of its own — shown at the court's.",
    access: 'Women: "the women watch from above and the men from below, so that they do not mingle" (Middot 2:5) — at Simchat Beit HaShoeivah, says the Gemara (Sukkah 51b).',
    services: ['Women watch Simchat Beit HaShoeivah from above (Middot 2:5; Sukkah 51b)'],
    description: "Ezrat Nashim was at first flat; “they surrounded it with a gallery”, so that men and women would not mingle (Middot 2:5). The Gemara ties it to the light-headedness of the water-drawing celebration, calls it a great repair and justifies adding it to the House's plan from Scripture (Sukkah 51b–52a); Rambam lists it as a fixture of the court (BhB 5:9). Its depth, height and stairs are not given: the model has balconies 4 amot deep, 10 amot above the floor, on the north, south and east.",
    sources: ['Middot 2:5', 'Sukkah 51b–52a', 'Rambam BhB 5:9'],
    stand: [327.5, 396, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Existence explicit; depth, height, extent and stairs are the model\'s.',
  },

  'lishkat-chashaim': {
    name: { en: "Lishkat Chasha'im — the chamber of secret gifts", he: 'לשכת חשאים', translit: "Lishkat Chasha'im" },
    sanctity: 5,
    sanctityNote: 'Placed in Ezrat Nashim in this model, with its rung.',
    access: 'Open, in secret, to those who give and to the poor who take (Shekalim 5:6).',
    services: ['The sin-fearing put gifts in secretly, and the poor of good families were supported from it secretly (Shekalim 5:6)'],
    description: "One of two chambers the Mishnah names “in the Mikdash” (Shekalim 5:6); where it stood is not said. The model sets it in Ezrat Nashim, under the north gallery, where men and women alike could come and go without notice (its footprint is unsourced).",
    sources: ['Shekalim 5:6', 'Reconstruction (model)'],
    stand: [327.5, 398, 6],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint and place unsourced (a nominal box).',
  },

  'fifteen-steps': {
    name: { en: 'The fifteen steps', he: 'חמש עשרה מעלות', translit: "Chamesh-esreh Ma'alot" },
    sanctity: 5,
    sanctityNote: "They rise from within Ezrat Nashim (Middot 2:5) and share its rung; the court's own sanctity begins inside Nikanor.",
    access: 'As Ezrat Nashim. The Levites stand on them to play and sing.',
    services: [
      'The Levites sing on them; there are fifteen, like the fifteen Songs of Ascents in Tehillim (Middot 2:5)',
      'At Simchat Beit HaShoeivah the Levites stand on them with kinnorot, nevalim, metziltayim and trumpets "without number" (Sukkah 5:4)',
      "At cockcrow on Sukkot two kohanim with trumpets stand in the upper gate at their head and sound teki'ah, teru'ah, teki'ah; they sound again on reaching the tenth step, again on reaching the court below, and go on sounding until they reach the east gate (Sukkah 5:4)",
    ],
    description: "Fifteen steps, each half an amah high, climb 7½ amot from Ezrat Nashim to Ezrat Yisrael (Middot 2:5; Rambam BhB 6:2). They were “not straight-edged but rounded, like half a round threshing floor” (Middot 2:5). The model draws them as concentric half-rings about the Nikanor gate with the Mishnah's half-amah tread (Middot 2:3), reaching 17½ amot out from the gate at their foot.",
    sources: ['Middot 2:3', 'Middot 2:5', 'Rambam BhB 6:2', 'Sukkah 5:4'],
    stand: [272.25, AX, 11.5],
    confidence: 'reconstruction',
    confidenceNote: 'Count, rise, tread and rounded form explicit; the landing radius is the model\'s.',
  },

  'music-chambers': {
    name: { en: 'The chambers of the instruments', he: 'לשכות כלי השיר', translit: 'Lishkot Klei HaShir' },
    sanctity: 5,
    sanctityNote: 'Under Ezrat Yisrael but opening into Ezrat Nashim (Middot 2:6); the sources give no rung — shown at that of the court they open to.',
    access: 'The Levites, who keep their instruments here (Middot 2:6).',
    services: [
      'The Levites keep their kinnorot, nevalim, metziltayim and all the instruments of song here (Middot 2:6; Rambam BhB 6:6)',
      'Shiltei HaGiborim adds that their music books were kept here too (Shiltei HaGiborim ch. 3)',
    ],
    description: "Chambers under Ezrat Yisrael, opening onto Ezrat Nashim, in the 7½-amah rise between the two courts (Middot 2:6; Rambam BhB 6:6). The model puts one on each side of the fifteen steps, 30 amot long, their doors opening east in the short stretch of wall between the steps and the corner chambers.",
    sources: ['Middot 2:6', 'Rambam BhB 6:6', 'Shiltei HaGiborim ch. 3'],
    stand: [249.5, 360, 6],
    confidence: 'reconstruction',
    confidenceNote: 'Their existence under Ezrat Yisrael is explicit; number, size and doors are the model\'s.',
  },

  // ===== Nikanor, Ezrat Yisrael, Ezrat Kohanim ================================
  nikanor: {
    name: { en: "Sha'ar Nikanor — the Upper Gate", he: 'שער ניקנור', translit: "Sha'ar Nikanor" },
    sanctity: 5,
    sanctityNote: "Its threshold was deliberately left without the court's sanctity, so that the metzora, the sotah and the yoledet could stand in it (Pesachim 85b; Yoma 30b–31a). The camp of the Shechinah begins inside it (Rambam BhB 7:11).",
    access: "No light-headed conduct facing it, since it stands opposite the Kodesh HaKodashim (Rambam BhB 7:5). A metzora on his eighth day stands in the gateway and puts his thumbs in for the blood (Yoma 30b–31a). When the magrefah is thrown, the head of the ma'amad stations the impure at the East Gate (Tamid 5:6).",
    services: [
      "The metzora's eighth-day rite: blood and oil put on his ear, thumb and toe as he stands in the gate (Yoma 30b; Vayikra 14:14)",
      'The sotah is made to drink at the East Gate, at the entrance of Sha\'ar Nikanor, and all who wish may come to watch (Sotah 1:5–6)',
      'Women after childbirth are purified here (Sotah 1:5)',
      "At the magrefah's signal the head of the ma'amad stations the impure at the East Gate (Tamid 5:6)",
      'On the eve of Yom Kippur, at dawn, the Kohen Gadol stands at the East Gate while bulls, rams and lambs are paraded before him (Yoma 1:3)',
      'A Levite keeps watch here through the night, outside (Middot 1:1; Rambam BhB 8:8)',
    ],
    description: "The eastern gate of the Azarah, at the head of the fifteen steps and exactly opposite the Heichal and the Kodesh HaKodashim (Rambam BhB 5:4; 7:5). Nikanor brought its doors from Alexandria; when every other gate was re-plated in gold these were left, because miracles were done with them — some say, because their bronze gleamed like gold; R. Eliezer ben Yaakov: it was Corinthian bronze that shone like gold (Middot 2:3; Yoma 38a). It stood 20 amot high and 10 wide, with a wicket on either side, flanked by the chambers of Pinchas the dresser and of the chavitin bakers (Middot 1:4; 2:6).",
    sources: ['Middot 1:1', 'Middot 1:4', 'Middot 2:3', 'Middot 2:6', 'Rambam BhB 5:4–5', 'Rambam BhB 7:5', 'Rambam BhB 7:11', 'Rambam BhB 8:8', 'Yoma 1:3', 'Yoma 30b', 'Yoma 38a', 'Sotah 1:5–6', 'Tamid 5:6', 'Pesachim 85b'],
    stand: [257.5, AX, 13.5],
    confidence: 'derived',
    confidenceNote: 'On the axis at the head of the fifteen steps; doors of unplated Corinthian bronze, with R. Eliezer ben Yaakov (Yoma 38a).',
  },

  'ezrat-yisrael': {
    name: { en: 'Ezrat Yisrael — the Court of Israel', he: 'עזרת ישראל', translit: 'Ezrat Yisrael' },
    sanctity: 6,
    sanctityNote: 'Closed to one still lacking atonement (mechusar kippurim); one who enters impure is liable to karet (Kelim 1:8; Rambam BhB 7:18).',
    access: "No mechusar kippurim — one who has immersed and seen sunset but not yet brought his offering — and no one impure, on pain of karet (Rambam BhB 7:18). No one sits anywhere in the Azarah except kings of the House of David (Yoma 25a; Rambam BhB 7:6). Leave walking backward, facing the House (Rambam BhB 7:4).",
    services: [
      "The ma'amad, the week's delegation of Israelites, stands here over the daily Tamid (Taanit 4:2)",
      "The people prostrate at each teki'ah between the sections of the Levites' song (Tamid 7:3)",
      'Pinchas the dresser, the officer over the vestments, keeps his chamber beside Nikanor; the Kohen Gadol\'s chavitin are made in the other (Middot 1:4; Shekalim 5:1; Tamid 1:3)',
    ],
    description: "The first eleven amot inside Sha'ar Nikanor: a strip 135 amot long and 11 wide, its floor 13½ amot above the Mount (Middot 2:6; 5:1; Rambam BhB 6:2). It was as near as an Israelite came to the altar, except to lean on, slaughter or wave his own offering (Kelim 1:8). On its west rises the step and the duchan of the Levites, 2½ amot in all (Middot 2:6).",
    sources: ['Middot 1:4', 'Middot 2:6', 'Middot 5:1', 'Kelim 1:8', 'Rambam BhB 6:2', 'Rambam BhB 7:4', 'Rambam BhB 7:6', 'Rambam BhB 7:18', 'Taanit 4:2', 'Tamid 7:3', 'Yoma 25a'],
    stand: [250, 300, 13.5],
    confidence: 'explicit',
  },

  'lishkat-hakelim': {
    name: { en: 'Lishkat HaKelim — the chamber of vessels', he: 'לשכת הכלים', translit: 'Lishkat HaKelim' },
    sanctity: 6,
    sanctityNote: 'Placed in Ezrat Yisrael in this model, with its rung.',
    access: 'Any donor may throw a vessel in; the treasurers open it once in thirty days (Shekalim 5:6).',
    services: [
      'Whoever donates a vessel throws it in; every thirty days the treasurers open it, keep what the upkeep of the House needs and sell the rest for the upkeep fund (Shekalim 5:6)',
      'At dawn the kohanim take the ninety-three vessels of silver and gold for the day out of "the chamber of vessels" (Tamid 3:4). Neither text refers to the other; that the two are one chamber is the model\'s reading',
    ],
    description: "The second chamber the Mishnah names “in the Mikdash”, with no place given (Shekalim 5:6). The model puts it in the north-east corner of the court, partly in Ezrat Yisrael and partly in the north wall, where donors can reach it and the kohanim have a short walk from the lamb chamber at dawn (its footprint is unsourced).",
    sources: ['Shekalim 5:6', 'Tamid 3:4', 'Reconstruction (model)'],
    stand: [249.5, 395, 13.5],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint and place unsourced (a nominal box); the identity of the donors\' chamber (Shekalim 5:6) with the dawn vessel store (Tamid 3:4) is the model\'s.',
  },

  'lishkat-pinchas': {
    name: { en: 'Lishkat Pinchas HaMalbish — the chamber of the vestments', he: 'לשכת פנחס המלביש', translit: 'Lishkat Pinchas HaMalbish' },
    sanctity: 6,
    sanctityNote: 'The Rambam counts it among the chambers "in Ezrat Yisrael" (BhB 5:17), and it is shown at that rung. The model builds it partly in the thickness of the Nikanor wall, opening to Ezrat Yisrael by its door and to Ezrat Nashim by the gate\'s right-hand wicket; the sources give it no rung of its own.',
    access: 'Kohanim, to be dressed and to return their garments; the officer over the vestments and his men. One who comes up from Ezrat Nashim enters by the right-hand wicket of Sha\'ar Nikanor (the commentary Ezrat Kohanim on Middot 2:6, after Chanukat HaBayit: the wickets are these chambers\' doorways).',
    services: [
      'Pinchas, the officer over the vestments, keeps the kohanim\'s garments (Shekalim 5:1: "Pinchas over the vestments")',
      'The chamber stands to the right of the east gate of the Azarah, for one entering westward (Middot 1:4; Rambam BhB 5:17)',
    ],
    description: "One of the two chambers that flank Sha'ar Nikanor: \"two chambers it had, one on its right and one on its left — the chamber of Pinchas the dresser and the chamber of the chavitin makers\" (Middot 1:4). Pinchas is the officer \"over the vestments\" in the Mishnah's list of the Temple's officers (Shekalim 5:1). The model puts it north of the gate (the right hand of one entering westward), in the wall and 7 amot into Ezrat Yisrael, 12 × 10 amot, its door to the court 4 × 8 and the gate's north wicket as its doorway to Ezrat Nashim.",
    sources: ['Middot 1:4', 'Middot 2:6', 'Shekalim 5:1', 'Rambam BhB 5:17', 'Yoma 19a', 'Ezrat Kohanim on Middot 2:6'],
    stand: [250.5, 341.5, 13.5],
    confidence: 'reconstruction',
    confidenceNote: 'Side (right of the gate = north) from Rambam BhB 5:17; its size, its place in the wall and its doors are reconstruction (site.js azarah.chamber.pinchas).',
  },

  'lishkat-chavitin': {
    name: { en: 'Lishkat Osei Chavitin — the chamber of the chavitin bakers', he: 'לשכת עושי חביתין', translit: 'Lishkat Osei Chavitin' },
    sanctity: 6,
    sanctityNote: 'The Rambam counts it among the chambers "in Ezrat Yisrael" (BhB 5:17), and it is shown at that rung. The model builds it partly in the thickness of the Nikanor wall, opening to Ezrat Yisrael by its door and to Ezrat Nashim by the gate\'s left-hand wicket.',
    access: 'Kohanim: the bakers of the Kohen Gadol\'s daily chavitin. One who comes up from Ezrat Nashim enters by the left-hand wicket of Sha\'ar Nikanor (the commentary Ezrat Kohanim on Middot 2:6, after Chanukat HaBayit).',
    services: [
      'Before dawn the two companies that searched the Azarah by torchlight, one round the east and one round the west, meet at the place of the chavitin makers: "Shalom — all is well!" — and the chavitin makers are set to make the chavitin (Tamid 1:3; Rambam BhB 8:11)',
      "The Kohen Gadol's daily minchah: a tenth of an ephah halved, baked in twelve loaves and fried on the griddle, half offered in the morning and half toward evening (Vayikra 6:13–14; Menachot 4:5; Menachot 6:5)",
    ],
    description: "The other chamber flanking Sha'ar Nikanor, to its left for one entering westward (Middot 1:4; Rambam BhB 5:17): here the Kohen Gadol's chavitin were made every day. It is the meeting point of the dawn inspection of the Azarah (Tamid 1:3). The model puts it south of the gate, in the wall and 7 amot into Ezrat Yisrael, 12 × 10 amot, with a hearth and griddle, its door to the court 4 × 8 and the gate's south wicket as its doorway to Ezrat Nashim.",
    sources: ['Middot 1:4', 'Middot 2:6', 'Tamid 1:3', 'Rambam BhB 5:17', 'Rambam BhB 8:11', 'Ezrat Kohanim on Middot 2:6', 'Menachot 4:5', 'Menachot 6:5'],
    stand: [250.5, 319.5, 13.5],
    confidence: 'reconstruction',
    confidenceNote: 'Side (left of the gate = south) from Rambam BhB 5:17; its size, its place in the wall and its doors are reconstruction (site.js azarah.chamber.chavitin).',
  },

  'ezrat-kohanim': {
    name: { en: 'Ezrat Kohanim — the Court of the Priests', he: 'עזרת כהנים', translit: 'Ezrat Kohanim' },
    sanctity: 7,
    sanctityNote: "Israelites enter only when they must — to lean on, slaughter or wave their own offering (Kelim 1:8; Rambam BhB 7:19). The court beyond, round the altar and the House, shares this rung; only the strip between the Ulam and the altar is higher (Kelim 1:9).",
    access: 'Kohanim. Israelites only for semichah, slaughter and tenufah of their own offerings (Kelim 1:8; Rambam BhB 7:19); slaughter is valid even by a non-kohen (Zevachim 3:1). Levites come up onto the duchan to sing.',
    services: [
      'The Levites stand on the duchan to sing over the offerings — never fewer than twelve (Arachin 2:6; Rambam BhB 6:6)',
      "At the wine libation of each Tamid they sing the shir shel yom, the psalm of the day (Tamid 7:4); at each perek the trumpets sound a teki'ah and the people prostrate (Tamid 7:3). The nine blasts of each Tamid are three sets of three, one at each of the three sections (Sukkah 5:5; Bartenura ad loc.)",
      'Owners lean their hands on their offerings and wave the parts to be waved (Kelim 1:8)',
      'The Yom Kippur lots: the Kohen Gadol comes "to the east of the court, north of the altar", the segan at his right and the head of the beit av at his left; the two goats and the kalpi with its two lots are there (Yoma 3:9)',
    ],
    description: "The second strip of eleven amot, 135 long — “the place where the kohanim tread” (Middot 5:1) — raised 2½ amot above Ezrat Yisrael (Middot 2:6). The anonymous Mishnah marks the line between the two courts only with rashei pispasin, stone heads set in the floor; R. Eliezer ben Yaakov describes a step one amah high with the duchan on it, three half-amah steps, which Rambam follows and the model builds (Middot 2:6; Rambam BhB 6:3). West of it rises the altar's east face.",
    sources: ['Middot 2:6', 'Middot 5:1', 'Kelim 1:8–9', 'Rambam BhB 6:3', 'Rambam BhB 6:6', 'Rambam BhB 7:19', 'Arachin 2:6', 'Tamid 7:3–4', 'Sukkah 5:5', 'Bartenura on Sukkah 5:5', 'Zevachim 3:1', 'Yoma 3:9'],
    stand: [238, 300, 16],
    confidence: 'explicit',
  },

  // ===== The Azarah ==========================================================
  azarah: {
    name: { en: 'The Azarah — the Temple court', he: 'העזרה', translit: 'Azarah' },
    sanctity: 7,
    sanctityNote: "The court round the altar and the House has the rung of Ezrat Kohanim; only the strip between the Ulam and the altar is higher (Kelim 1:8–9).",
    access: "Kohanim for the service; Israelites as in Ezrat Kohanim, for their own offerings (Kelim 1:8). No one sits except kings of the House of David (Yoma 25a; Rambam BhB 7:6). One walks slowly, in awe, and leaves walking backward (Rambam BhB 7:4–5). One who becomes impure inside leaves by the shortest way (Shevuot 2:3).",
    services: [
      'The two daily Tamid offerings, morning and afternoon, and the musafim of Shabbat, Rosh Chodesh and the festivals (Tamid; Bamidbar 28)',
      "When the gates are opened in the morning, three blasts are sounded — teki'ah, teru'ah, teki'ah — the first of the twenty-one blasts sounded in the Mikdash every day at the least (Sukkah 5:5)",
      'Before dawn two companies with torches go round the court from Beit HaMoked, one east and one west, and meet at the chavitin chamber: "Shalom — all is well" (Tamid 1:3)',
      'On erev Pesach the Pesach offerings are slaughtered in three groups, the doors of the court shut on each (Pesachim 5:5)',
      'On the festivals the crowd stood pressed together and yet bowed with room to spare, filling even the eleven amot behind the Beit HaKaporet (Yoma 21a; Avot 5:5)',
      'Male kohanim eat the most-holy offerings within the court, until midnight (Zevachim 5:3)',
    ],
    description: "The whole court was 187 amot from east to west and 135 from north to south (Middot 2:6; 5:1–2). From the east: Ezrat Yisrael 11, Ezrat Kohanim 11, the altar 32, the space before the Ulam 22, the Heichal 100, and 11 behind the Beit HaKaporet (Middot 5:1). It was paved throughout with fine stone and entered by seven gates — three on the north, three on the south, Nikanor on the east (Rambam BhB 1:10; Middot 1:4–5). Its walls were high, all but the eastern (Middot 2:4); the model's 40 amot and 5-amah thickness follow the commentary Ezrat Kohanim (on Middot 2:1).",
    sources: ['Middot 1:4–5', 'Middot 2:4', 'Middot 2:6', 'Middot 5:1–2', 'Kelim 1:8', 'Rambam BhB 1:10', 'Rambam BhB 5:4', 'Rambam BhB 7:4–6', 'Tamid 1:3', 'Yoma 21a', 'Avot 5:5', 'Pesachim 5:5', 'Zevachim 5:3', 'Sukkah 5:5', 'Shevuot 2:3', 'Ezrat Kohanim on Middot 2:1'],
    stand: [229, 292, 16],
    confidence: 'explicit',
    confidenceNote: 'Both dimension chains explicit; wall height and thickness follow the commentary Ezrat Kohanim (on Middot 2:1).',
  },

  mizbeach: {
    name: { en: 'The Mizbeach — the outer altar', he: 'המזבח', translit: 'HaMizbeach' },
    sanctity: 7,
    sanctityNote: 'The altar stands in the court and has its rung; its own laws are stricter: only kohanim serve on it, and no one goes up by steps (Bamidbar 18:7; Rambam BhB 1:17).',
    access: 'Kohanim only, for the service, and only by the ramp — going up to it by steps is forbidden (Shemot 20:23; Rambam BhB 1:17). The kohanim go up on the east side of the ramp, round the top to the right, and down on the west; on Yom Kippur the Kohen Gadol goes up and down the middle (Yoma 4:5; Yoma 15b).',
    services: [
      "Through the night the fats and limbs of the day's offerings burn on the pile; their time runs until first light (Berachot 1:1), and what has not been consumed is put back on the fire in the morning (Tamid 2:5) — except Friday's on Shabbat morning, which waits at the side of the altar until Shabbat is over (Rambam TuM 1:7)",
      'Terumat hadeshen at cockcrow or close to it — on Yom Kippur from midnight, on the festivals from the first watch: a pan of the inner, burnt-out coals is taken down and laid east of the ramp (Yoma 1:8; Tamid 1:4)',
      'The ash is heaped on the tapuach in the middle of the altar; on the festivals it is left there as an adornment (Tamid 2:2)',
      'The great pile is laid on the east, its face to the east; the second pile, for the incense coals, four amot north of the south-western horn (Tamid 2:4–5)',
      "The Tamid's blood is put on the north-eastern and south-western corners, the rest poured on the southern base (Tamid 4:1)",
      "The limbs of the Tamid are offered, then the libation: the segan stands on the horn with the sudarin in his hand; two kohanim with silver trumpets stand on the table of the fats, sound teki'ah, teru'ah, teki'ah, and take their places at Ben Arza's right and left (Tamid 7:3)",
      "The kohen bends to pour the wine — at the south-western corner, where the circuit of the altar ends (Tamid 7:3; Zevachim 64a) — the segan waves the sudarin, Ben Arza strikes the tziltzal, and the Levites break into song (Tamid 7:3)",
      'On Sukkot water is poured at the south-western horn, and willows are stood round the altar\'s sides (Sukkah 4:5; 4:9)',
    ],
    description: "Thirty-two amot square at its base, it rose in steps: a base (yesod) of one amah, five more to the circuit ledge (sovev), three more to the top, and horns an amah high at the corners — ten amot in all, by R. Yosi's reading, which Rambam follows (Middot 3:1; Zevachim 59b–60a; Rambam BhB 2:5). Its fires burned on the 24-amah square inside the horns and the kohanim's walkway (Middot 3:1). It was cast solid of whole stones in lime, lead and pitch, untouched by iron, whitewashed twice a year, and girdled at half its height by a red line that divided the upper bloods from the lower (Middot 3:1; 3:4; Rambam BhB 2:16). How many piles burned on it each day is disputed — R. Meir four, R. Yosi three, R. Yehudah two (Yoma 4:6; Yoma 45a); the model shows R. Yosi's three: the great pile, the incense pile, and the pile that keeps the fire.",
    sources: ['Middot 3:1–4', 'Zevachim 59b–60a', 'Zevachim 64a', 'Rambam BhB 1:17', 'Rambam BhB 2:5', 'Rambam BhB 2:16', 'Berachot 1:1', 'Tamid 1:4', 'Tamid 2:2–5', 'Tamid 4:1', 'Tamid 7:3', 'Yoma 1:8', 'Yoma 4:6', 'Yoma 45a', 'Sukkah 4:5', 'Sukkah 4:9', 'Bamidbar 18:7', 'Shemot 20:23', 'Yoma 4:5', 'Yoma 15b'],
    stand: [217, 309, 25],
    confidence: 'locked',
    confidenceNote: "Size and stepped profile explicit; the ten-amah height (R. Yosi, as Rambam BhB 2:5; Rambam's mixed-amah schedule of 58 tefachim, BhB 2:6–9, is the recorded alternative), the north–south placement (R. Eliezer ben Yaakov, Yoma 16a–17a) and the three piles (R. Yosi, Yoma 4:6) are the model's choices among the opinions. The third pile's place is the model's.",
  },

  kevesh: {
    name: { en: 'The Kevesh — the altar ramp', he: 'הכבש', translit: 'Kevesh' },
    sanctity: 7,
    sanctityNote: "Part of the court, at its rung; like the altar, only kohanim go up it for the service.",
    access: 'Kohanim, for the service: up on the east side, down on the west (Yoma 4:5).',
    services: [
      'The limbs of the Tamid are laid on the lower half of the ramp, on its west side, and salted there (Tamid 4:3); Shekalim 8:8 says the east side — the model follows Tamid',
      'The silver pan for terumat hadeshen rests in the corner between the ramp and the altar, west of the ramp (Tamid 1:4)',
      'Beit HaDeshen: the coals are heaped on the pavement about ten amot along the east of the ramp, three tefachim from it (Tamid 1:4)',
      'The marble table west of the ramp holds the limbs; at the libation the two trumpeters stand by it (Shekalim 6:4; Tamid 7:3)',
      'Unfit bird-offerings are put in the revuvah, a window in the ramp\'s west side (Middot 3:3), and left there until their form decays (Rambam BhB 2:14)',
    ],
    description: "The ramp ran up the south side of the altar, 32 amot long and 16 wide (Middot 3:3; Rambam BhB 2:13), because the Torah forbids going up to the altar by steps (Shemot 20:23). It covered 30 amot of ground and flew the last two over the base and the ledge, with “a little air” left between it and the altar so that the limbs were put on the altar with a throw (Rambam BhB 2:13). Two small ramps branched from it, to the circuit ledge and to the base, standing a hair's breadth from the altar (Rambam BhB 2:14; Zevachim 62b).",
    sources: ['Middot 3:3', 'Middot 5:2', 'Rambam BhB 1:17', 'Rambam BhB 2:13–15', 'Zevachim 62b', 'Tamid 1:4', 'Tamid 4:3', 'Tamid 7:3', 'Shekalim 6:4', 'Shekalim 8:8', 'Shemot 20:23', 'Yoma 4:5'],
    stand: [221, 291.5, 20.5],
    confidence: 'explicit',
    confidenceNote: 'Length, width and south side explicit; centring on the altar\'s south face and the small ramps\' slope are the model\'s.',
  },

  'slaughter-zone': {
    name: { en: 'The Tzafon — the place of slaughter', he: 'בית המטבחיים', translit: 'Beit HaMitbachayim' },
    sanctity: 7,
    sanctityNote: 'Part of the court, at its rung.',
    access: 'As the court. The most-holy offerings may be slaughtered only here, in the north (Rambam BhB 5:16). Slaughter is valid even by a non-kohen, so an Israelite may slaughter his own offering (Zevachim 3:1; Kelim 1:8).',
    services: [
      "The morning Tamid is slaughtered by the north-western corner of the altar, on the second ring; the afternoon's by the north-eastern corner, on the second ring (Tamid 4:1)",
      'The lamb is bound, not tied: head to the south, face to the west; the slaughterer stands on the east facing west (Tamid 4:1)',
      'Before slaughter it is given water from a gold cup and checked again by torchlight (Tamid 3:4)',
      'The carcass is hung on the iron hooks of the dwarf pillars and flayed; the innards are rinsed on the marble tables (Middot 3:5; Tamid 3:5; 4:2)',
      'On erev Pesach rows of kohanim pass the blood up to the altar in basins all of silver or all of gold, which had no flat bases (Pesachim 5:5)',
    ],
    description: "North of the altar the court was given to slaughter: 24 rings fixed in the floor to hold the animals, marble tables, and eight dwarf pillars (nanasin) topped with squared blocks of cedar and three rows of iron hooks (Middot 3:5). The Mishnah counts the bands from the altar north — 8 amot to the rings, the rings 24, 4 to the tables, 4 to the pillars, 8 from the pillars to the wall, the remainder between the ramp and the south wall and in the pillars' own place (Middot 5:2); Rambam counts from the north wall — 8, the slaughterhouse 12½, the tables 8, the rings 24, 8 to the altar (BhB 5:13–15) — and the model builds Rambam's bands, which put the altar's north face 60½ amot from the wall (BhB 5:15). The model sets the rings in six rows of four — the Mishnah's first opinion; others say four of six — and the tables in Rambam's band, though Middot 3:5 speaks of flaying “on marble tables between the pillars”.",
    sources: ['Middot 3:5', 'Middot 5:2', 'Tamid 3:4–5', 'Tamid 4:1–2', 'Rambam BhB 5:13–16', 'Zevachim 3:1', 'Pesachim 5:5', 'Shekalim 6:4'],
    stand: [217, 341.5, 16],
    confidence: 'derived',
    confidenceNote: 'The bands are Rambam\'s (Middot 5:2 divides the same ground differently); the arrangement of rings, tables and pillars within them is the model\'s.',
  },

  'bein-haulam-lamizbeach': {
    name: { en: 'Between the Ulam and the Mizbeach', he: 'בין האולם ולמזבח', translit: 'Bein HaUlam LaMizbeach' },
    sanctity: 8,
    sanctityNote: 'Closed to kohanim with blemishes and to those with grown hair (Kelim 1:9); Rambam adds those in torn garments (BhB 7:20).',
    access: 'Kohanim only: without blemish, hair trimmed, garments whole (Kelim 1:9; Rambam BhB 7:20). Everyone draws back from here while the incense is offered in the Heichal (Tamid 6:3; Yoma 44a).',
    services: [
      'The magrefah is thrown down here: "no one in Jerusalem could hear his fellow for its noise"; the kohanim run in to bow, the Levites to sing (Tamid 5:6)',
      'The kohanim of the inner service go up the twelve steps into the Ulam (Tamid 6:1)',
      'The kiyor stands here, drawn to the south (Middot 3:6)',
      'On Yom Kippur the Kohen Gadol\'s bull stands here, its head to the south and its face to the west, for his confession (Yoma 3:8)',
    ],
    description: "A strip 22 amot wide across the court, from the face of the Ulam to the altar (Middot 3:6; 5:1), holier than the court around it (Kelim 1:9). Most of its width is taken by the twelve steps of the Ulam; the kiyor stands toward the south, out of the middle (Middot 3:6; Zevachim 59a).",
    sources: ['Middot 3:6', 'Middot 5:1', 'Kelim 1:9', 'Rambam BhB 7:20', 'Tamid 5:6', 'Tamid 6:1–3', 'Yoma 3:8', 'Yoma 44a', 'Zevachim 59a'],
    stand: [197, 346, 16],
    confidence: 'explicit',
  },

  kiyor: {
    name: { en: 'The Kiyor — the laver', he: 'הכיור', translit: 'Kiyor' },
    sanctity: 8,
    sanctityNote: 'In the strip between the Ulam and the altar, at its rung.',
    access: 'Kohanim. No kohen touches a vessel of the service until he has sanctified his hands and feet from it (Tamid 1:4).',
    services: [
      'Each kohen sanctifies his hands and feet before he serves (Tamid 1:4; 2:1)',
      'Ben Katin gave it twelve spigots, so that the twelve kohanim busy with the Tamid could sanctify at once (Yoma 3:10; Yoma 37a)',
      'He also made the muchni, a wheel that sank it into the water overnight so that its water would not become unfit by standing overnight (Yoma 3:10; Rambam BhB 3:18)',
      'The creak of the muchni\'s wood at dawn told the kohanim waiting below that the time had come (Tamid 1:4); it was heard as far as Yericho (Tamid 3:8)',
    ],
    description: "The laver stood “between the Ulam and the altar, drawn toward the south” (Middot 3:6; Rambam BhB 1:6). The muchni itself was chol, so the water kept in it did not become unfit (Rambam BhB 3:18). The Mishnah gives no size: the model makes it a bronze basin 4 amot across, room for twelve kohanim round its twelve spigots, with the muchni's wheel on its south side and a well beneath.",
    sources: ['Middot 3:6', 'Rambam BhB 1:6', 'Rambam BhB 3:18', 'Tamid 1:4', 'Tamid 2:1', 'Tamid 3:8', 'Yoma 3:10', 'Yoma 37a'],
    stand: [193.2, 317, 16],
    confidence: 'reconstruction',
    confidenceNote: '"Between the Ulam and the altar, drawn south" and the twelve spigots are explicit; size and exact place are the model\'s.',
  },

  'ulam-steps': {
    name: { en: 'The steps of the Ulam', he: 'מעלות האולם', translit: "Ma'alot HaUlam" },
    sanctity: 8,
    sanctityNote: 'In the strip between the Ulam and the altar, at its rung.',
    access: 'Kohanim only, as the strip they stand in (Kelim 1:9).',
    services: [
      'Birkat kohanim: after the incense the kohanim stand on these steps and bless the people as one blessing, with the Name as it is written, their hands raised above their heads — the Kohen Gadol not above the tzitz (Tamid 7:2)',
      'The kohanim who cleared the inner altar and the Menorah go up first, ahead of the others (Tamid 6:1)',
      'On Yom Kippur the bull\'s blood is kept stirred "on the fourth rovad" so it will not congeal (Yoma 4:3) — taken in the model as the fourth landing of these steps (reconstruction)',
    ],
    description: "Twelve steps climb 6 amot from the court to the Ulam, each half an amah high but an amah deep, broken by wider landings: “amah, amah, and a landing of three; amah, amah, and a landing of three; and at the top, amah, amah, and a landing of four” — R. Yehudah: five (Middot 3:6). Rambam gives them the ordinary half-amah tread (BhB 6:4); the model follows the Mishnah, with four landings and a level amah at the foot. Their width is not given; the model makes them 20 amot, the width of the Ulam's opening.",
    sources: ['Middot 3:6', 'Rambam BhB 6:4', 'Tamid 6:1', 'Tamid 7:2', 'Yoma 4:3', 'Reconstruction (model)'],
    stand: [186.5, AX, 20.5],
    confidence: 'reconstruction',
    confidenceNote: 'Rises and treads explicit; width and the level amah at the foot are the model\'s (four landings make the run 21 of the 22).',
  },

  // ===== The chambers of the Azarah ==========================================
  gazit: {
    name: { en: 'Lishkat HaGazit — the Chamber of Hewn Stone', he: 'לשכת הגזית', translit: 'Lishkat HaGazit' },
    sanctity: 7,
    sanctityNote: 'Half in kodesh and half in chol, with a door to each (Yoma 25a; Rambam BhB 5:17). Its eastern half has the court\'s rung; its western half, where the Sanhedrin sat, lies outside the court\'s sanctity — in this model, within the Chel.',
    access: 'The eastern half: kohanim at the lotteries and the morning prayers, standing (Yoma 25a). The western half: the Great Sanhedrin, seated, since sitting is allowed only outside the court\'s sanctity (Rambam BhB 7:6).',
    services: [
      'The lotteries: the kohanim stand in a circle, the officer lifts one man\'s mitre to mark where the count begins, and each holds out one finger or two — never a thumb (Yoma 2:1; Yoma 25a)',
      'Three of the day\'s four lotteries are cast here: the thirteen tasks of the Tamid; the incense, "new men only"; and who carries the limbs from the ramp to the altar (Yoma 2:3–4; Tamid 3:1; 5:2). The first, for terumat hadeshen, is cast before dawn in Beit HaMoked (Tamid 1:2)',
      'After the second lottery the officer says, "Go out and see whether the time for slaughter has come"; the watcher calls "Barkai!" In Matya ben Shmuel\'s form: "The whole face of the east is lit!" — "As far as Hebron?" — "Yes!" (Tamid 3:2; Yoma 3:1). Once moonlight was taken for dawn, and the Tamid slaughtered too early had to be burned (Yoma 3:1). The sources do not say where the watcher stood',
      'With the limbs laid on the ramp, the kohanim return here for one blessing, the Ten Commandments, Shema, and three blessings; on Shabbat one more for the outgoing mishmar (Tamid 4:3; 5:1)',
      'Those not chosen hand their garments to the attendants and keep only their trousers; windows here are labelled with the garments each holds (Tamid 5:3; Yoma 25a)',
      'The Great Sanhedrin judges the priesthood: a kohen found unfit dresses in black and goes away; one found fit dresses in white and serves with his brothers (Middot 5:4)',
    ],
    description: "“Like a great basilica”, half in kodesh and half in chol, with one door into the court and one outward; the lottery was held in its east and the elder sat in its west (Yoma 25a; Rambam BhB 5:17). The sources fix its use and its two halves, not its size or place; with Yoma 19a and Rambam it is one of the northern trio, in front of the Etz, while the printed Mishnah puts that trio in the south (Middot 5:3–4). The model makes it 45 by 20 amot, straddling the court's western wall at its north end, so that its kodesh half lies east and its chol half west, as Yoma 25a requires. In the last forty years the Sanhedrin left it for the Chanut on Har HaBayit (Shabbat 15a).",
    sources: ['Middot 5:3–4', 'Yoma 2:1–4', 'Yoma 3:1', 'Yoma 19a', 'Yoma 25a', 'Tamid 1:2', 'Tamid 2:5', 'Tamid 3:1–2', 'Tamid 4:3', 'Tamid 5:1–3', 'Rambam BhB 5:17', 'Rambam BhB 7:6', 'Shabbat 15a'],
    stand: [70, 378, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint unsourced; the north trio follows Yoma 19a and Rambam BhB 5:17; the west-wall straddle is site.js\'s reading of it (flagged there for sign-off).',
  },

  golah: {
    name: { en: 'Lishkat HaGolah — the chamber of the cistern', he: 'לשכת הגולה', translit: 'Lishkat HaGolah' },
    sanctity: 7,
    sanctityNote: 'One of the six chambers "in the Azarah" (Middot 5:3), at the court\'s rung.',
    access: 'As the court.',
    services: [
      'A cistern was fixed here with a wheel set over it, "and from there they supplied water to the whole court" (Middot 5:4)',
    ],
    description: "One of the six chambers of the court (Middot 5:3), it held the court's own water: a cistern with a wheel (galgal) over it (Middot 5:4). Rambam explains the name: they drew from the cistern “with the golah”, the wheel (BhB 5:17). Its size is not given; the model makes it 10 by 10 amot, between the Gazit and the court, in front of the Etz.",
    sources: ['Middot 5:3–4', 'Rambam BhB 5:17', 'Yoma 19a'],
    stand: [96, 383, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint unsourced; "in front of the Etz" explicit; the north trio follows Yoma 19a and Rambam BhB 5:17.',
  },

  'etz-parhedrin': {
    name: { en: "Lishkat HaEtz — the Kohen Gadol's chamber (Parhedrin)", he: 'לשכת העץ — לשכת פרהדרין', translit: 'Lishkat HaEtz / Lishkat Parhedrin' },
    sanctity: 4,
    sanctityNote: "The sources give this chamber no rung. The Kohen Gadol lived and slept here for seven days, yet no one may sit in the court (Yoma 25a; Rambam BhB 7:6); the model infers a chamber built in the court but opening to chol, whose inside is chol by the general rule of Rambam BhB 6:7 — the reading that the commentary Ezrat Kohanim adopts from Tosafot (on Middot 5:3–4) — and shows it at the rung of the Chel it opens onto. That is an inference: Yoma 11a gives Sha'ar Nikanor a mezuzah because Lishkat Parhedrin lay “inside it”, which suggests the way to it ran through the court.",
    access: "The Kohen Gadol's dwelling for the seven days before Yom Kippur (Yoma 1:1). The sources do not say where its door was; the model gives it one door, through the north wall and down steps to the Chel (reconstruction).",
    services: [
      'Seven days before Yom Kippur the Kohen Gadol is moved from his house to this chamber, and another kohen is readied in case he becomes unfit (Yoma 1:1)',
      'All week he practises: he throws the blood, burns the incense, trims the lamps and offers the head and the leg (Yoma 1:2)',
      'Elders of the court read him the order of the day: "My master the Kohen Gadol, read it aloud yourself — perhaps you have forgotten, or perhaps you never learned" (Yoma 1:3)',
      'He is sprinkled with the ashes of the Parah: R. Meir, all seven days; R. Yosi, only on the third and seventh; R. Chanina Segan HaKohanim, the third and seventh for the Kohen Gadol (Yoma 8a; Parah 3:1). The third and seventh are shown',
      'Of all the chambers only this one had a mezuzah, being the Kohen Gadol\'s dwelling; R. Yehudah: only by rabbinic decree (Yoma 10a). Of the gates only Sha\'ar Nikanor had one, because Lishkat Parhedrin lay inside it (Yoma 11a)',
    ],
    description: "R. Eliezer ben Yaakov said “I have forgotten what it served”; Abba Shaul said it was the chamber of the Kohen Gadol, lying “behind the two” — the Gazit and the Golah — with the roofs of all three level (Middot 5:4). It is Lishkat Parhedrin, renamed when the high priesthood came to be bought year by year (Yoma 8b; Rambam BhB 5:17). The model, with Rambam, places it in the northern trio inside the court against the north wall (BhB 5:17); Rav Pappa leans to placing Parhedrin in the south, from the Kohen Gadol's first immersion on the Water Gate “beside his chamber”, but the Gemara leaves it unresolved (Yoma 19a).",
    sources: ['Middot 5:3–4', 'Yoma 1:1–3', 'Yoma 8a', 'Yoma 8b', 'Yoma 10a', 'Yoma 11a', 'Yoma 19a', 'Yoma 25a', 'Parah 3:1', 'Rambam BhB 5:17', 'Rambam BhB 6:7', 'Rambam BhB 7:6', 'Ezrat Kohanim on Middot 5:3–4'],
    stand: [83, 396, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint unsourced; "behind both" and level roofs explicit; north side with Rambam BhB 5:17; the chol interior and the door to the Chel are the model\'s inference.',
  },

  melach: {
    name: { en: 'Lishkat HaMelach — the salt chamber', he: 'לשכת המלח', translit: 'Lishkat HaMelach' },
    sanctity: 7,
    sanctityNote: 'One of the six chambers "in the Azarah" (Middot 5:3), at the court\'s rung.',
    access: 'As the court.',
    services: [
      'Salt for the offerings is kept here (Middot 5:3)',
      'Every offering is salted (Vayikra 2:13) — the limbs of the Tamid on the ramp among them (Tamid 4:3)',
    ],
    description: "One of the three chambers that Yoma 19a and Rambam place on the south of the court (BhB 5:17); the printed Mishnah puts this trio on the north (Middot 5:3), and the model follows Yoma and Rambam. Its size is not given; the model makes it 20 by 12 amot against the south wall.",
    sources: ['Middot 5:3', 'Yoma 19a', 'Rambam BhB 5:17', 'Tamid 4:3', 'Vayikra 2:13'],
    stand: [85, 272, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint and place along the wall unsourced; south trio follows Yoma 19a and Rambam BhB 5:17.',
  },

  parvah: {
    name: { en: 'Lishkat HaParvah — the hide chamber', he: 'לשכת הפרוה', translit: 'Lishkat HaParvah' },
    sanctity: 7,
    sanctityNote: 'One of the six chambers "in the Azarah", at the court\'s rung; its roof too was kodesh — the Kohen Gadol\'s immersions there were "in kodesh" (Yoma 3:3).',
    access: 'As the court. On Yom Kippur its roof is the Kohen Gadol\'s place of immersion, screened from the people by a linen sheet (Yoma 3:3–4).',
    services: [
      'The hides of the offerings are salted here (Middot 5:3)',
      'On Yom Kippur the Kohen Gadol makes four of his five immersions and his sanctifications of hands and feet on its roof, in kodesh, behind a sheet of linen (Yoma 3:3–4; Middot 5:3)',
    ],
    description: "One of the southern trio (Yoma 19a; Rambam BhB 5:17), where the hides of the offerings were salted (Middot 5:3); the Gemara says it was named for Parvah, a magus (Yoma 35a). On its roof was the Kohen Gadol's place of immersion for Yom Kippur (Middot 5:3). The model makes it 20 by 12 amot with a raised tank on its roof, reached by the winding stair from the Medichin next door.",
    sources: ['Middot 5:3', 'Yoma 3:3–4', 'Yoma 19a', 'Yoma 31a', 'Yoma 35a', 'Rambam BhB 5:17'],
    stand: [130.25, 272, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint unsourced; south trio after Yoma 19a and Rambam BhB 5:17; the roof tank\'s form is the model\'s.',
  },

  medichin: {
    name: { en: "Lishkat HaMedichin — the rinsers' chamber", he: 'לשכת המדיחין', translit: 'Lishkat HaMedichin' },
    sanctity: 7,
    sanctityNote: 'One of the six chambers "in the Azarah", at the court\'s rung.',
    access: 'As the court.',
    services: [
      'The innards of the offerings are rinsed here (Middot 5:3)',
      'The stomach of the Tamid is rinsed in the beit medichin as much as it needs (Tamid 4:2)',
      'A winding stair goes up from it to the roof of the Parvah (Middot 5:3)',
    ],
    description: "The third of the southern trio (Yoma 19a; Rambam BhB 5:17): the place “where they rinsed the innards of the offerings”, with a winding stair rising from it to the roof of the Parvah (Middot 5:3). The model makes it 12 by 12 amot against the south wall, the stair in its corner.",
    sources: ['Middot 5:3', 'Tamid 4:2', 'Yoma 19a', 'Rambam BhB 5:17'],
    stand: [148, 272, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Footprint unsourced; south trio after Yoma 19a and Rambam BhB 5:17.',
  },

  // ===== Beit HaMoked and the way under the Mount ============================
  'beit-hamoked': {
    name: { en: 'Beit HaMoked — the Hearth House', he: 'בית המוקד', translit: 'Beit HaMoked' },
    sanctity: 4,
    sanctityNote: 'Half in kodesh and half in chol, rashei pispasin dividing (Middot 1:6, as Rashi reads it). The south half, toward the court, has the court\'s rung; the kohanim slept in the north half, outside the court\'s sanctity — shown at the Chel\'s rung. Rambam\'s school holds the whole hall chol, with two chambers opening to kodesh (the commentary Ezrat Kohanim on Middot 1:6).',
    access: 'The kohanim of the beit av on duty sleep here: the elders on the stone ledges with the keys of the court, the young kohanim each with his bedding on the floor (Middot 1:8; Tamid 1:1). A Levite sleeps outside the door (Middot 1:9).',
    services: [
      'The kohanim sleep in their own clothes, the sacred garments folded and laid under their heads (Tamid 1:1; Rambam BhB 8:6: beside their heads)',
      'At closing time a kohen lifts the marble slab by its ring, takes the keys from the chain and locks up from inside, while a Levite sleeps outside; then he returns the keys and the slab, lays his garment over it and sleeps (Middot 1:9). Ben Gever was the officer over the locking of the gates (Shekalim 5:1)',
      'A kohen made impure in the night goes down by the winding stair to the Beit HaTevilah (Middot 1:9; Tamid 1:1)',
      'At cockcrow or near it the officer knocks; "whoever has immersed, come and cast lots!" (Tamid 1:2)',
      'The officer opens the wicket into the court and two companies with torches go in to inspect it (Tamid 1:3)',
      'A fire is kept in its hearth (Shabbat 1:11); kohanim keep watch here at night (Middot 1:1)',
      'In its lamb chamber never fewer than six inspected lambs are kept, enough for a Shabbat and the two days of Rosh Hashanah (Arachin 2:5)',
      'Tamid 3:3 counts Lishkat HaChotamot, the chamber of the seals, among its four; the name points to the seals bought from Yochanan ben Pinchas as vouchers for libations (Shekalim 5:1; 5:4)',
    ],
    description: "A great domed hall between the court and the Chel, with a door to each, ringed with stepped ledges of stone (Middot 1:5–8; Rambam BhB 5:9). Four chambers opened off it “like small rooms opening onto a hall”: the Tamid lambs, the showbread bakers, the altar stones the Greek kings defiled, and the stair down to the Beit HaTevilah (Middot 1:6). Tamid 3:3 lists them differently, with the lamb chamber in the north-west; the Gemara reconciles the lists, and the model sets the lamb chamber south-west with its corner cut off (Yoma 15b–17a). Its size is not given; the model has a hall 24 by 24 amot straddling the north wall at the easternmost north gate (reconstruction).",
    sources: ['Middot 1:1', 'Middot 1:5–9', 'Tamid 1:1–3', 'Tamid 3:3', 'Shabbat 1:11', 'Shekalim 5:1', 'Shekalim 5:4', 'Arachin 2:5', 'Rambam BhB 5:9–11', 'Rambam BhB 8:5–7', 'Rambam BhB 8:11', 'Yoma 15b–17a', 'Ezrat Kohanim on Middot 1:6', 'Ezrat Kohanim on Middot 1:9', 'Reconstruction (model)'],
    stand: [207, 404.5, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Hall size and straddle are unsourced; its station follows the commentary Ezrat Kohanim (on Middot 1:9); the corner chambers\' sizes are the model\'s.',
  },

  'underground-passage': {
    name: { en: 'The passage under the Birah', he: 'המסיבה ההולכת תחת הבירה', translit: 'HaMesibah HaHolechet Tachat HaBirah' },
    sanctity: 2,
    sanctityNote: 'Passages under the Mount that open to Har HaBayit were not sanctified (Rambam BhB 6:9; 8:7) — which is why a kohen made impure in the night, who may not stay even on the Mount (Devarim 23:11), could walk here. Shown at Jerusalem\'s rung.',
    access: 'The kohen made impure in the night, going down from Beit HaMoked to immerse (Tamid 1:1; Middot 1:9).',
    services: [
      'A kohen who had an emission in the night goes along it to the Beit HaTevilah, lamps burning on either side (Tamid 1:1; Middot 1:9)',
      'R. Eliezer ben Yaakov: it ran under the Chel and he went out by Tadi (Middot 1:9); the model follows the anonymous Mishnah (Tamid 1:1)',
    ],
    description: "A winding way “that goes under the Birah”, lamps burning on either side, from the north-western chamber of Beit HaMoked down to the Beit HaTevilah (Tamid 1:1; Middot 1:6; 1:9). Whether the Birah was a building north of the courts or a name for the whole precinct is open (Yoma 2a); Rambam has the passage run under the whole Mikdash (BhB 5:11). The model's spiral stair and vaulted passage north under the Mount are reconstruction.",
    sources: ['Tamid 1:1', 'Middot 1:6', 'Middot 1:9', 'Rambam BhB 5:11', 'Rambam BhB 6:9', 'Rambam BhB 8:7', 'Devarim 23:11', 'Yoma 2a'],
    stand: [203.25, 430, -12],
    confidence: 'reconstruction',
    confidenceNote: 'Route, depth and form unsourced.',
  },

  'beit-hatevilah': {
    name: { en: 'Beit HaTevilah — the house of immersion', he: 'בית הטבילה', translit: 'Beit HaTevilah' },
    sanctity: 2,
    sanctityNote: 'Reached by the unsanctified passage under the Mount (Rambam BhB 6:9; 8:7); shown at Jerusalem\'s rung.',
    access: 'Kohanim made impure in the night (Tamid 1:1).',
    services: [
      'He goes down and immerses, comes up and dries himself, warms himself at the fire, then sits with his brothers until the gates open and goes on his way (Tamid 1:1)',
      'The privy of honour: if it was found locked, one knew someone was inside; if open, that no one was (Tamid 1:1)',
    ],
    description: "An underground house of immersion at the end of the passage under the Birah, with a fire (medurah) and a “privy of honour” (Tamid 1:1). A mikveh holds water “that the whole body rises in”: an amah by an amah, three amot high (Yoma 31a). Its place and plan are not given; the model sets it under the north of the Mount.",
    sources: ['Tamid 1:1', 'Middot 1:9', 'Rambam BhB 5:11', 'Rambam BhB 8:7', 'Yoma 31a'],
    stand: [203, 458, -12],
    confidence: 'reconstruction',
    confidenceNote: 'Place, plan and depth unsourced.',
  },

  // ===== Upper chambers over the court gates ==================================
  'beit-avtinas': {
    name: { en: "Beit Avtinas — the incense makers' chamber", he: 'בית אבטינס', translit: 'Beit Avtinas' },
    sanctity: 3,
    sanctityNote: "An upper chamber (Tamid 1:1), set in the model on the Water Gate. The Water Gate's roof was chol — the Kohen Gadol's one immersion outside kodesh was made there (Yoma 3:3; Yoma 31a) — and upper storeys took no sanctity of the court (Rambam BhB 6:7). Shown at Har HaBayit's rung.",
    access: 'Kohanim: the house of Avtinas compounds the incense, and young kohanim keep watch here at night (Tamid 1:1; Middot 1:1).',
    services: [
      'Young kohanim keep the night watch here (Tamid 1:1; Middot 1:1)',
      'The house of Avtinas compounds the incense — and would not teach its craft (Shekalim 5:1; Yoma 3:11)',
      'On the eve of Yom Kippur the elders of the priesthood bring the Kohen Gadol up here and make him swear to change nothing; he turns aside and weeps, and they turn aside and weep (Yoma 1:5)',
      'Here he is taught to take the handfuls of incense (Yoma 19a)',
      'On Yom Kippur morning his first immersion is on the roof of the Water Gate, in chol, "beside his chamber" (Yoma 19a; Yoma 31a) — this chamber, on the model\'s reading',
    ],
    description: "An upper chamber (Tamid 1:1), one of those “built beside the gates of the court” (Rambam BhB 8:5). Rav Pappa counts it one of the Kohen Gadol's two chambers, one in the north and one in the south beside the Water Gate, where his first Yom Kippur immersion was made “beside his chamber”; he does not know which was which, leans to Parhedrin in the south — which would put Avtinas in the north — and the Gemara leaves it open (Yoma 19a; 31a). The model follows Rambam, whose Parhedrin is the northern Lishkat HaEtz (BhB 5:17); that leaves Avtinas the southern chamber, and the model sets it on the Water Gate's roof, 20 amot above the court floor, with the first mikveh beside it, its water 23 amot above the court — the height of the En Eitam spring as Abaye reckons it (Yoma 31a). Its size is not given.",
    sources: ['Tamid 1:1', 'Middot 1:1', 'Shekalim 5:1', 'Yoma 1:5', 'Yoma 3:11', 'Yoma 19a', 'Yoma 31a', 'Rambam BhB 5:17', 'Rambam BhB 8:5'],
    stand: [204, 260.5, 36],
    confidence: 'reconstruction',
    confidenceNote: "Upper chamber explicit. Its place on the Water Gate is derived, not stated: Yoma 19a and 31a give only \"beside his chamber\", and it is Avtinas only with Rambam's north Parhedrin (BhB 5:17). Footprint and height are the model's.",
  },

  'beit-hanitzotz': {
    name: { en: 'Beit HaNitzotz — the upper storey of the Nitzotz gate', he: 'בית הניצוץ', translit: 'Beit HaNitzotz' },
    sanctity: 3,
    sanctityNote: ROOF_NOTE,
    access: 'Kohanim on night watch (Middot 1:1; 1:5).',
    services: ['Kohanim keep watch above while Levites keep watch below (Middot 1:5; Tamid 1:1)'],
    description: "Sha'ar HaNitzotz was “like an exedra, with an upper storey built on it; the kohanim kept watch above and the Levites below” (Middot 1:5). This upper storey, Beit HaNitzotz, is one of the three posts of the kohanim (Middot 1:1; Tamid 1:1). Its size is not given; the model opens it to the court in four bays.",
    sources: ['Middot 1:1', 'Middot 1:5', 'Tamid 1:1', 'Rambam BhB 8:5'],
    stand: [112.25, 398, 36],
    confidence: 'reconstruction',
    confidenceNote: 'On the gate is explicit; footprint, height and bays are the model\'s.',
  },

  // ===== The gates of the Azarah =============================================
  'gate-delek': {
    name: { en: "Sha'ar HaDelek — the gate of the firewood", he: 'שער הדלק', translit: "Sha'ar HaDelek" },
    sanctity: 7,
    sanctityNote: 'The gateway counts as within the court (Rambam BhB 6:9); its outer stair descends through the Chel.',
    access: COURT_GATE_ACCESS,
    services: [
      "Its name means fuel; Bartenura explains it as the gate by which the altar's wood came in — the Mishnah gives the name only (Middot 1:4)",
      'A Levite keeps watch outside it at night (Middot 1:1; Rambam BhB 8:8)',
    ],
    description: "One of the three gates in the south wall (Middot 1:4), 20 amot high and 10 wide, with gold-plated doors and a curtain (Middot 2:3; Yoma 54a). Rambam has the three gates “near the west” (BhB 5:4); the order with Delek westmost and the 39¼-amah spacing follow the commentary Ezrat Kohanim (on Middot 1:9). The court here is 16 amot above the Mount, so the model gives each side gate 32 half-amah steps down to the Chel — a necessity of the levels, not a source.",
    sources: ['Middot 1:1', 'Middot 1:4', 'Middot 2:3', 'Rambam BhB 5:4', 'Rambam BhB 6:9', 'Rambam BhB 8:8', 'Yoma 54a', 'Bartenura on Middot 1:4', 'Ezrat Kohanim on Middot 1:9'],
    stand: [112.25, 260.5, 16],
    confidence: 'locked',
    confidenceNote: 'Size explicit; station after the commentary Ezrat Kohanim (on Middot 1:9); the exterior stair is reconstruction.',
  },

  'gate-bechorot': {
    name: { en: "Sha'ar HaBechorot — the gate of the firstborn", he: 'שער הבכורות', translit: "Sha'ar HaBechorot" },
    sanctity: 7,
    sanctityNote: 'The gateway counts as within the court (Rambam BhB 6:9); its outer stair descends through the Chel.',
    access: COURT_GATE_ACCESS,
    services: [
      'Its name means the firstborn; Bartenura explains it as the gate by which firstborn animals were brought in — the Mishnah gives the name only (Middot 1:4)',
      'A Levite keeps watch outside it at night (Middot 1:1; Rambam BhB 8:8)',
    ],
    description: "The middle gate of the south wall (Middot 1:4), 20 by 10 with gold-plated doors and a curtain (Middot 2:3; Yoma 54a). Its station follows the commentary Ezrat Kohanim (on Middot 1:9); its long outer stair down to the Chel is reconstruction.",
    sources: ['Middot 1:1', 'Middot 1:4', 'Middot 2:3', 'Rambam BhB 5:4', 'Rambam BhB 6:9', 'Rambam BhB 8:8', 'Yoma 54a', 'Bartenura on Middot 1:4', 'Ezrat Kohanim on Middot 1:9'],
    stand: [161.5, 260.5, 16],
    confidence: 'locked',
    confidenceNote: 'Size explicit; station after the commentary Ezrat Kohanim (on Middot 1:9); the exterior stair is reconstruction.',
  },

  'gate-mayim': {
    name: { en: "Sha'ar HaMayim — the Water Gate", he: 'שער המים', translit: "Sha'ar HaMayim" },
    sanctity: 7,
    sanctityNote: "The gateway counts as within the court (Rambam BhB 6:9); its roof did not — the Kohen Gadol's immersion there was in chol (Yoma 31a).",
    access: COURT_GATE_ACCESS,
    services: [
      "Each morning of Sukkot the golden flask of water for the libation is brought in by it, with teki'ah, teru'ah and teki'ah (Middot 2:6; Sukkah 4:9)",
      'R. Eliezer ben Yaakov: through it the water trickles, and in time to come it will flow out from under the threshold of the House (Middot 2:6; Yechezkel 47:1)',
      "The Kohen Gadol's first Yom Kippur immersion is on its roof, in chol, \"beside his chamber\" (Yoma 19a; Yoma 31a); the model takes that chamber as Beit Avtinas, with Rambam's north Parhedrin (BhB 5:17)",
      'A Levite keeps watch outside it at night (Middot 1:1; Rambam BhB 8:8)',
    ],
    description: "The south gate opposite the altar (the commentary Ezrat Kohanim on Middot 1:9), 20 by 10 with gold-plated doors (Middot 2:3). Its gatehouse roof was “marble, negligibly thin”, so the mikveh on it stood at the gate's height plus three amot — 23 amot above the court, the level of the En Eitam spring (Yoma 31a–b). The aqueduct from En Eitam is taken to have entered here, and the model brings the court's drain out under its threshold toward the Kidron (reconstruction).",
    sources: ['Middot 1:4', 'Middot 2:3', 'Middot 2:6', 'Sukkah 4:9', 'Shekalim 6:3', 'Yoma 19a', 'Yoma 31a', 'Rambam BhB 5:4', 'Rambam BhB 5:17', 'Ezrat Kohanim on Middot 1:9', 'Reconstruction (model)'],
    stand: [210.75, 260.5, 16],
    confidence: 'locked',
    confidenceNote: 'Size explicit; station after the commentary Ezrat Kohanim (on Middot 1:9); the aqueduct junction and the drain\'s course are reconstruction.',
  },

  'gate-nitzotz': {
    name: { en: "Sha'ar HaNitzotz — the gate of the spark", he: 'שער הניצוץ', translit: "Sha'ar HaNitzotz" },
    sanctity: 7,
    sanctityNote: 'The gateway counts as within the court (Rambam BhB 6:9); the storey above it does not (Rambam BhB 6:7).',
    access: 'Into the court, as the Azarah. At night kohanim, not Levites, hold this gate (Rambam BhB 8:8): kohanim keep watch above, Levites below (Middot 1:5).',
    services: [
      'Night watch: kohanim above in Beit HaNitzotz, Levites below (Middot 1:5)',
      'It has a door to the Chel (Middot 1:5)',
    ],
    description: "The first of the north gates, “like an exedra”, with an upper storey on it and a door to the Chel (Middot 1:5). No wooden exedra stood in the court (Rambam BhB 1:9), so the model opens its gatehouse to the court through four marble columns, with a spiral stair to the storey above; its station follows the commentary Ezrat Kohanim (on Middot 1:9).",
    sources: ['Middot 1:1', 'Middot 1:5', 'Rambam BhB 1:9', 'Rambam BhB 5:4', 'Rambam BhB 8:8', 'Ezrat Kohanim on Middot 1:9'],
    stand: [112.25, 400.5, 16],
    confidence: 'locked',
    confidenceNote: 'Size explicit; station after the commentary Ezrat Kohanim (on Middot 1:9); the exedra\'s form is reconstruction.',
  },

  'gate-korban': {
    name: { en: "Sha'ar HaKorban — the gate of the offering", he: 'שער הקרבן', translit: "Sha'ar HaKorban" },
    sanctity: 7,
    sanctityNote: 'The gateway counts as within the court (Rambam BhB 6:9); its outer stair descends through the Chel.',
    access: COURT_GATE_ACCESS,
    services: [
      'Its name means the offering; Bartenura explains it as the way the most-holy offerings, slaughtered in the north, were brought in — the Mishnah gives the name only (Middot 1:5)',
      'A Levite keeps watch outside it at night (Middot 1:1; Rambam BhB 8:8)',
    ],
    description: "The middle gate of the north wall (Middot 1:5), 20 by 10 with gold-plated doors (Middot 2:3), opening onto the Tzafon, where the most-holy offerings were slaughtered (Rambam BhB 5:16). In this model Lishkat HaKorban and Lishkat HaParochet stand on the Mount on either side of the foot of its stair.",
    sources: ['Middot 1:1', 'Middot 1:5', 'Middot 2:3', 'Rambam BhB 5:16', 'Rambam BhB 6:9', 'Rambam BhB 8:8', 'Bartenura on Middot 1:5', 'Ezrat Kohanim on Middot 1:9'],
    stand: [161.5, 400.5, 16],
    confidence: 'locked',
    confidenceNote: 'Size explicit; station after the commentary Ezrat Kohanim (on Middot 1:9); the exterior stair is reconstruction.',
  },

  'gate-moked': {
    name: { en: "Sha'ar Beit HaMoked — the gate of the Hearth House", he: 'שער בית המוקד', translit: "Sha'ar Beit HaMoked" },
    sanctity: 7,
    sanctityNote: 'The gate into the court, at its rung; the hall behind it is half chol.',
    access: 'Into the court, as the Azarah. At night the kohanim of Beit HaMoked hold it, not Levites (Rambam BhB 8:8). R. Yehudah: it had a small wicket by which the patrol went in to search the court (Middot 1:7).',
    services: [
      'Before dawn the officer opens the wicket from Beit HaMoked into the court and two companies with torches go in (Tamid 1:3; Rambam BhB 8:11)',
      'On Friday nights they inspect without torches, by the lamps lit before Shabbat (Rambam BhB 8:12)',
    ],
    description: "The third north gate is Beit HaMoked itself (Middot 1:5): the hall had two doors, one open to the Chel and one to the court (Middot 1:7). The model makes it the easternmost of the north gates, facing the Water Gate across the altar (the commentary Ezrat Kohanim on Middot 1:9), with the wicket in its eastern leaf.",
    sources: ['Middot 1:5', 'Middot 1:7', 'Tamid 1:3', 'Rambam BhB 8:8', 'Rambam BhB 8:11–12', 'Ezrat Kohanim on Middot 1:9'],
    stand: [210.75, 388.5, 16],
    confidence: 'reconstruction',
    confidenceNote: 'Station after the commentary Ezrat Kohanim (on Middot 1:9); its depth follows the reconstructed hall.',
  },

  // ===== The House ============================================================
  ulam: {
    name: { en: 'The Ulam — the porch', he: 'האולם', translit: 'Ulam' },
    sanctity: 9,
    sanctityNote: 'Part of the House: the Ulam, the Kodesh and the Kodesh HaKodashim "are all called Heichal" (Rambam BhB 1:5). None enters without washed hands and feet (Kelim 1:9; Rambam BhB 7:21).',
    access: 'Kohanim, with hands and feet washed, for the service or to bow (Kelim 1:9; Rambam BhB 7:21).',
    services: [
      'Two tables inside, at the entrance of the House: the new showbread is laid on the marble one going in, the old on the gold one coming out — "one raises in holiness and does not lower" (Shekalim 6:4; Rambam BhB 3:16)',
      'Donors bring a leaf, a grape or a cluster of gold and hang it on the golden vine over the entrance of the Heichal (Middot 3:8)',
      'Young kohanim climb the gold chains fixed in its ceiling to see the crowns (Middot 3:8)',
      "At sunrise Queen Helena's golden nivreshet over the entrance throws off sparks — the city's sign for Shema (Yoma 3:10; Yoma 37b)",
      'Each morning the kohen opens the north wicket into the ta, crosses the Heichal and opens the great gate from within; its sound is the slaughterer\'s signal (Tamid 3:7)',
      'On Yom Kippur a strip of crimson wool was at first tied on the outside of its doorway, and the people rejoiced when it turned white and were ashamed when it did not; it was moved inside, and when they still peeped, it was tied half to the rock and half between the goat\'s horns (Yoma 67a)',
    ],
    description: "A hall 11 amot deep across the whole 100-amah front, its opening 40 amot high and 20 wide — the one opening in the Mikdash without doors; a curtain hung there instead (Middot 2:3; 3:7; 4:7; Yoma 54a). Over the opening ran five lintels of milah wood, the lowest 22 amot long, each longer than the one below by an amah at either end, the top one 30, with a course of stone between each (Middot 3:7). Cedar beams tied its front wall back to the Heichal so that it would not bulge (Middot 3:8). Its inner height is not given; the model sets its ceiling level with the Kodesh's, 40 amot.",
    sources: ['Middot 2:3', 'Middot 3:7–8', 'Middot 4:7', 'Rambam BhB 1:5', 'Rambam BhB 3:16', 'Rambam BhB 4:8', 'Rambam BhB 7:21', 'Kelim 1:9', 'Shekalim 6:4', 'Tamid 3:7', 'Yoma 3:10', 'Yoma 37b', 'Yoma 54a', 'Yoma 67a'],
    stand: [168.5, AX, 22],
    confidence: 'explicit',
    confidenceNote: 'Plan and opening explicit; inner height is the model\'s.',
  },

  'beit-hachalifot': {
    name: { en: 'Beit HaChalifot — the knife store', he: 'בית החליפות', translit: 'Beit HaChalifot' },
    sanctity: 9,
    sanctityNote: 'The wings of the Ulam (Middot 4:7), at its rung.',
    access: 'As the Ulam: kohanim only.',
    services: [
      'The slaughter knives are put away here (Middot 4:7)',
      "Each mishmar had its own place; Bilgah's window was sealed and its ring fixed, a lasting mark of shame (Sukkah 5:8; Sukkah 56b)",
      'R. Yosi b. R. Yehudah: two wickets 8 amot high in it made the whole court fit for slaughtering kodashim kalim; the baraita adds "for eating kodshei kodashim", but Ravina strikes that out (Zevachim 55b–56a)',
    ],
    description: "The Ulam was 100 amot across but the House behind it only 70, so the porch ran 15 amot past the body on the north and on the south (Middot 4:7). These two wings were called Beit HaChalifot, “where they stored away the knives” (Middot 4:7). The niches' number and places are not given; Shiltei HaGiborim puts twelve in each wing, as the commentary Ezrat Kohanim reports him (on Middot 4:7).",
    sources: ['Middot 4:7', 'Sukkah 5:8', 'Sukkah 56b', 'Zevachim 55b–56a', 'Ezrat Kohanim on Middot 4:7'],
    stand: [168.5, 370.5, 22],
    confidence: 'explicit',
    confidenceNote: 'Plan explicit; height (taken as the Ulam\'s) and the niches are the model\'s.',
  },

  heichal: {
    name: { en: 'The Heichal — the Kodesh', he: 'ההיכל', translit: 'Heichal' },
    sanctity: 9,
    sanctityNote: 'None enters without washed hands and feet (Kelim 1:9; Rambam BhB 7:21).',
    access: 'Kohanim only, hands and feet washed, for the service or to bow (Kelim 1:9; Rambam BhB 7:21). While the incense is offered everyone leaves the Heichal (Tamid 6:3; Yoma 44a). Repairs are done by unblemished kohanim if possible, let down in closed boxes (Rambam BhB 7:23).',
    services: [
      "At dawn the inner altar's ash is cleared into the teni, and the Menorah's lamps are cleaned — five before the Tamid's blood is thrown, two after (Tamid 3:9; 6:1; Yoma 33a)",
      'Incense on the golden altar, morning and afternoon; in the morning it falls by lot to a kohen who has never offered it, and everyone withdraws while he burns it (Tamid 5:2; 6:3; Yoma 2:4)',
      'Between the evenings the Menorah is lit from the western lamp, left burning since morning; if it had gone out, it is cleaned and relit from the outer altar (Tamid 6:1; Shemot 30:8). In Shimon HaTzaddik\'s forty years it never failed; in the last forty years before the destruction it did not stay lit (Yoma 39a–b)',
      'Every Shabbat eight kohanim change the showbread together, so that the table is never bare (Menachot 11:7)',
      'On Yom Kippur the Kohen Gadol sprinkles the blood of the bull, then of the goat, toward the parochet opposite the Aron, once upward and seven times downward; then he puts the mingled blood on the horns of the golden altar and sprinkles its top seven times (Yoma 5:4–6). A baraita says toward the curtain, not on it — yet R. Elazar b. R. Yosi saw it in Rome with drops of the blood on it (Yoma 57a)',
      'When the Kohen Gadol enters to bow, three hold him; the officer lifts the curtain for him as he comes out (Tamid 7:1)',
      "Dust for the sotah's water is taken from under a marble slab with a ring, to the right on entering (Sotah 2:2)",
    ],
    description: "The Kodesh was 40 amot long, 20 wide and 40 high, behind a doorway 20 high and 10 wide with four doors (Middot 4:1; 4:6–7; Yoma 52a). The whole house was plated with gold except the wall behind the doors (Middot 4:1). In its inner two-thirds stood the golden table on the north and the Menorah on the south, each two and a half amot from its wall, with the golden incense altar between them, a little toward the entrance (Rambam BhB 3:17; Yoma 33b). The kohen came in daily by the north wicket and the north-eastern ta, never by the south wicket, of which Yechezkel said “this gate shall be shut” (Middot 4:2).",
    sources: ['Middot 4:1–2', 'Middot 4:6–7', 'Kelim 1:9', 'Rambam BhB 3:17', 'Rambam BhB 7:21', 'Rambam BhB 7:23', 'Tamid 3:6–9', 'Tamid 5:2', 'Tamid 6:1–3', 'Tamid 7:1', 'Yoma 2:4', 'Yoma 5:4–6', 'Yoma 33a', 'Yoma 33b', 'Yoma 39a–b', 'Yoma 44a', 'Yoma 52a', 'Yoma 57a', 'Menachot 11:7', 'Sotah 2:2', 'Shemot 30:8'],
    stand: [146, 337.5, 22],
    standHeading: 236, // the Menorah at three-quarters, the golden altar and the table (schedule.js V.kodesh)
    confidence: 'explicit',
    confidenceNote: 'Room explicit; the vessels\' east–west station within the inner two-thirds is the model\'s.',
  },

  'amah-traksin': {
    name: { en: 'Amah Traksin — between the two curtains', he: 'אמה טרקסין', translit: 'Amah Traksin' },
    sanctity: 10,
    sanctityNote: 'Its status was the very doubt: no one knew whether the amah of the First Temple\'s dividing wall belonged to the Kodesh or to the Kodesh HaKodashim (Yoma 51b–52a; Rambam BhB 4:2). The sources describe only the Kohen Gadol walking in it, on Yom Kippur — shown at the Kodesh HaKodashim\'s rung.',
    access: 'The Kohen Gadol alone, on Yom Kippur (Yoma 5:1).',
    services: [
      'On Yom Kippur the Kohen Gadol enters at the south, where the outer curtain is pinned back, walks north between the curtains, turns, and enters the Kodesh HaKodashim where the inner curtain is pinned back at the north (Yoma 5:1)',
    ],
    description: "In the First Temple a wall one amah thick divided the Kodesh from the Kodesh HaKodashim. The builders of the Second did not know to which room that amah had belonged, so they built no wall but hung two curtains an amah apart, the outer pinned back at its south end and the inner at its north (Yoma 5:1; Yoma 51b–52a; Rambam BhB 4:2). R. Yosi holds there was a single curtain (Yoma 5:1); the model follows the Sages and Rambam. Each curtain was a tefach thick and 40 amot by 20, woven on 72 cords of 24 threads (Shekalim 8:5).",
    sources: ['Yoma 5:1', 'Yoma 51b–52a', 'Rambam BhB 4:2', 'Shekalim 8:5', 'Middot 4:7'],
    stand: [116.5, 322, 22],
    confidence: 'locked',
    confidenceNote: 'Two curtains an amah apart (Yoma 52b; Rambam BhB 4:2), each a tefach thick (Shekalim 8:5); the clear way between them is about 4 tefachim.',
  },

  'kodesh-hakodashim': {
    name: { en: 'Kodesh HaKodashim — the Holy of Holies', he: 'קודש הקדשים', translit: 'Kodesh HaKodashim' },
    sanctity: 10,
    sanctityNote: 'The highest rung: none enters but the Kohen Gadol on Yom Kippur, at the time of the service (Kelim 1:9; Rambam BhB 7:22).',
    access: 'No one, ever — but the Kohen Gadol on Yom Kippur, at the time of the service (Kelim 1:9; Rambam BhB 7:22): with the incense, with the blood of the bull, with the blood of the goat, and to bring out the ladle and pan (Yoma 5:1–4; Yoma 7:4).',
    services: [
      'On Yom Kippur the Kohen Gadol sets the pan of coals on the Even Shetiyah and the incense on it, filling the house with smoke (Yoma 5:1–2)',
      'He sprinkles the blood of the bull, then of the goat, toward the place of the Aron — once upward and seven times downward, counting aloud (Yoma 5:3–4)',
      'Craftsmen are let down into it from the aliyah in closed boxes, so that their eyes do not feast on it (Middot 4:5; Rambam BhB 7:23)',
    ],
    description: "A room 20 amot by 20 and 40 high (Middot 4:7; Yoma 52a). In the Second Temple it stood empty: the Aron, its cover and the keruvim were among the things that House lacked (Yoma 21b). There was only a stone “from the days of the early prophets”, called Shetiyah, three fingerbreadths above the floor, on which the Kohen Gadol set down the pan (Yoma 5:2). No windows are recorded; its walls were lined with plates of beaten gold (Shekalim 4:4).",
    sources: ['Middot 4:5', 'Middot 4:7', 'Kelim 1:9', 'Rambam BhB 4:1', 'Rambam BhB 7:22–23', 'Yoma 5:1–4', 'Yoma 7:4', 'Yoma 21b', 'Yoma 52a', 'Shekalim 4:4'],
    stand: [104, AX, 22],
    confidence: 'explicit',
    confidenceNote: 'Room explicit; the stone\'s footprint is the model\'s (empty but for the Even Shetiyah — Yoma 5:2; Yoma 21b).',
  },

  taim: {
    name: { en: "The Ta'im — the side chambers", he: 'התאים', translit: "Ta'im" },
    sanctity: 9,
    sanctityNote: "Side cells within the House's hundred amot (Middot 4:7), entered only through the Ulam and opening into the Heichal; the sources give them no rung — shown at the Heichal's.",
    access: 'Kohanim. The daily way into the Heichal runs through the north-eastern ta (Middot 4:2; Tamid 3:7).',
    services: [
      'Each morning the kohen with the two keys opens the north wicket, goes into the ta and from it into the Heichal, and opens the great gate from within (Tamid 3:7; Middot 4:2)',
      'R. Yehudah: he walked inside the thickness of the wall instead (Middot 4:2)',
    ],
    description: "Thirty-eight cells round three sides of the House: fifteen on the north, five over five over five; fifteen on the south; and eight on the west, three over three and two above (Middot 4:3). Each had three doors — to the cell on its right, on its left, and above; the north-eastern one had five: to the right, above, the mesibah, the wicket and the Heichal (Middot 4:3). They widened upward, 5, 6 and 7 amot, as the wall stepped back to carry each floor without beams entering it (Middot 4:4; I Melachim 6:6). Their heights are not given; the model makes each storey 11 amot, with solid walls between the cells, as Rashi reads them (the commentary Ezrat Kohanim on Middot 4:3).",
    sources: ['Middot 4:2–4', 'Middot 4:7', 'Tamid 3:7', 'Rambam BhB 4:9–11', 'I Melachim 6:6', 'Ezrat Kohanim on Middot 4:3'],
    stand: [150, 350, 22],
    confidence: 'reconstruction',
    confidenceNote: 'Count, widths and doors explicit; storey heights and the solid-wall reading (Rashi\'s, against Rambam\'s hollow walls) are the model\'s.',
  },

  mesibah: {
    name: { en: 'The Mesibah — the winding ascent', he: 'המסיבה', translit: 'Mesibah' },
    sanctity: 9,
    sanctityNote: "A passage within the House's hundred amot (Middot 4:7), reached from the north-eastern ta; the sources give it no rung — shown at the Heichal's.",
    access: 'Kohanim going up to the roofs and the aliyah — for inspection and repair (Middot 4:5; Rambam BhB 7:23).',
    services: ["The way up to the roofs of the ta'im and on to the door of the aliyah (Middot 4:5)"],
    description: "A passage 3 amot wide along the north of the House, inside its own wall of 5 (Middot 4:7), by which “they went up to the roofs of the ta'im”: one climbed from the north-eastern corner facing west along the north, turned south along the west, then east along the south to the door of the aliyah, which opened to the south (Middot 4:5; Rambam BhB 4:12). Its form is not given; the model has flights of half-amah steps with landings, open to the sky as the commentary Ezrat Kohanim holds (on Middot 4:7).",
    sources: ['Middot 4:5', 'Middot 4:7', 'Rambam BhB 4:12', 'Ezrat Kohanim on Middot 4:7'],
    stand: [155, 359, 22],
    confidence: 'reconstruction',
    confidenceNote: 'Width and route explicit; flights, landings and open top are the model\'s.',
  },

  aliyah: {
    name: { en: 'The Aliyah — the upper storey', he: 'העלייה', translit: 'Aliyah' },
    sanctity: 9,
    sanctityNote: "Upper storeys did not take the court's sanctity (Rambam BhB 6:7), yet the place over the Kodesh HaKodashim was entered only “once in a shavua”, to see what needed repair (Rambam BhB 7:23) — read as once in seven years, for the other views in the baraita are twice in a shavua and once in a jubilee (Pesachim 86a) — and rashei pispasin in its floor marked the line over the two rooms (Middot 4:5). Shown at the Heichal's rung; the part over the Kodesh HaKodashim is stricter.",
    access: 'Closed. Entered for inspection — over the Kodesh HaKodashim only "once in a shavua" (Rambam BhB 7:23), read as once in seven years (Pesachim 86a) — by unblemished kohanim if possible, then blemished kohanim, then Levites, then Israelites (Rambam BhB 7:23).',
    services: [
      'Craftsmen are let down through the lulin, hatches in its floor, into the Kodesh HaKodashim in closed boxes (tevot), "so that their eyes should not feast on it" (Middot 4:5)',
      'Two curtains hang here too, over the line of the curtains below (Yoma 54a)',
      'At its door two cedar posts lead up to its roof (Middot 4:5)',
    ],
    description: "A second hall over the Kodesh and the Kodesh HaKodashim, 40 amot high between its floor and ceiling courses (Middot 4:6). Its door opened to the south, reached by the mesibah over the roofs of the ta'im (Middot 4:5). Rashei pispasin in its floor divided the space over the Kodesh from that over the Kodesh HaKodashim, and hatches opened through it into the room below (Middot 4:5).",
    sources: ['Middot 4:5–6', 'Rambam BhB 4:3', 'Rambam BhB 4:13', 'Rambam BhB 6:7', 'Rambam BhB 7:23', 'Yoma 54a', 'Pesachim 86a'],
    stand: [140, AX, 67],
    confidence: 'explicit',
    confidenceNote: 'Height and plan explicit; the place of the lulin and the door\'s east–west position are the model\'s.',
  },

  roof: {
    name: { en: 'The roof of the Heichal', he: 'גג ההיכל', translit: 'Gag HaHeichal' },
    sanctity: 3,
    sanctityNote: ROOF_NOTE,
    access: 'Only those sent up for repairs, by the way through the House: the mesibah, the aliyah, and the cedar posts at its door (Middot 4:5).',
    services: ['None in the order of the day. The iron kalya orev round the parapet kept birds from settling (Middot 4:6; Rambam BhB 4:3)'],
    description: "The House rose 100 amot from the court: the otem, a solid podium of 6; the Kodesh, 40; ceiling courses, 5; the aliyah, 40; roof courses, 5; a parapet (ma'akeh) of 3; and the kalya orev of 1 (Middot 4:6). The kalya orev, the “raven-destroyer”, was an iron blade an amah high, “like a sword”, round the parapet so birds could not perch (Rambam BhB 4:3); Rashi describes plates edged like knives and set with sharp nails (Rashi on Shabbat 90a). R. Yehudah: the kalya orev was not counted, and the parapet was 4 (Middot 4:6).",
    sources: ['Middot 4:5–6', 'Rambam BhB 4:3', 'Rambam BhB 6:7', 'Rashi on Shabbat 90a'],
    stand: [170, AX, 112],
    confidence: 'explicit',
    confidenceNote: 'Height stack explicit (Middot 4:6; crown +116 over the Eastern Gate); the blade form is Rambam\'s (BhB 4:3).',
  },

  'taim-roofs': {
    name: { en: "The roofs of the ta'im", he: 'גגות התאים', translit: "Gagot HaTa'im" },
    sanctity: 3,
    sanctityNote: ROOF_NOTE,
    access: 'Reached only by the mesibah from inside the House (Middot 4:5).',
    services: ['The walk from the head of the mesibah along the west and the south to the door of the aliyah (Middot 4:5)'],
    description: "The mesibah brought one up “to the roofs of the ta'im” (Middot 4:5). From here one sees the high windows of the Kodesh, narrow within and wide without, so that the House sends its light out to the world (Menachot 86b). The sources give no height; the model sets these roofs 33 amot above the Heichal's floor, below the windows, with a flight on the south roof up to the aliyah's door, since Middot 4:5 does not say the walk was level.",
    sources: ['Middot 4:5', 'Menachot 86b'],
    stand: [105, 309.5, 55],
    confidence: 'reconstruction',
    confidenceNote: 'The walk on the roofs is explicit; their height and the stair to the aliyah are the model\'s.',
  },

  'ulam-upper': {
    name: { en: 'The Ulam above its ceiling', he: 'האולם — מעל לתקרה', translit: 'Ulam' },
    sanctity: 3,
    sanctityNote: ROOF_NOTE,
    access: 'No source describes this part of the building or a way into it.',
    services: ['None recorded'],
    description: "The Ulam's front wall rose the full hundred amot of the House (Middot 4:6–7), but no source says what lay between the Ulam's ceiling and the roof; the gold chains hung from that ceiling (Middot 3:8). The model builds it as solid masonry, so it has no observer spot; the roof above it is the nearest place to stand.",
    sources: ['Middot 3:8', 'Middot 4:6–7'],
    stand: null,
    confidence: 'reconstruction',
    confidenceNote: 'Undescribed; built solid (docs/decisions/build-heichal.md).',
  },
};

// =============================================================================
// Mikdash — OBJECTS  (src/data/objects.js, owner: inspect — console-design §6.2 "Describing objects")
// =============================================================================
// What a visitor can click and learn about: the site's gates, chambers, stairs, ramps, openings, curtains and fixtures
// (src/data/site.js elements), a few things that are not elements (the thirteen shofarot) and the altar's and hearths'
// fires. Keyed by site element id, or 'fire:<fx id>', or an own key with a pick box.
//
//   OBJECTS[id] = {
//     title?: { en, he },        default: the site element's name
//     subtitle?: { en },
//     aka?: [],                  extra search terms (search indexes these)
//     purpose: { en, sources } | null       what it is for — sourced; null = name, measures and sources only
//     use?: { en, sources },     how it was used (the card's "How it was used")
//     notes?: { en, sources },   more sourced facts, disputes, what the model chose
//     glossary?: 'term',         a GLOSSARY key
//     inAction?: [{ event, label: { en } }],   events (src/data/schedule.js ids) in which it is seen in use
//     view?: { at: [X, Y, Z?], heading },     where to stand to see it (else computed)
//     aliases?: [ids],           movable / fx ids that stand for it (ctx.movables keys)
//     zone?, zones?: [],         its place (else the zone at its base)
//     pickBox?: { min, max },    site amot: a pick box for an object that is not a site element
//     confidence?, confidenceNote?
//   }
//   ALIASES = { aliasId: objectId } (built below)
//
// Picking: an element's site box is its pick box unless the entry gives pickBoxes (site amot) — the thirteen breaches'
// stations and the open runs of the channel, whose element boxes span the whole Mount — or pick: false.
// Rules: no purpose without sources (src/sim/dev/tests/objects-check.mjs rejects it); where the sources are silent the
// entry says what is the model's. Text checked against the report (Parts I–V, VII, IX, XII) and the Hebrew of Middot,
// Tamid, Shekalim and Parah (sources/).
// =============================================================================
import { SITE } from './site.js';

const GATE_STD = { en: "Every gateway in the Mikdash was twenty amot high and ten wide and had doors (all but the Ulam's); every gate had a lintel except Tadi's; all the gates were later plated with gold except Nikanor's.", sources: ['Middot 2:3'] };
const MOUNT_GATE_USE = { en: "All who come onto Har HaBayit enter by the right, go round and leave by the left; a mourner and one under a ban go round to the left. By night a Levite keeps watch at each of the Mount's five gates.", sources: ['Middot 2:2', 'Middot 1:1'] };
const COURT_GATE_USE = { en: "A Levite kept watch outside each gate of the Azarah through the night; each gate had a curtain — seven of the thirteen curtains of the Second Temple hung on the seven gates.", sources: ['Middot 1:1', 'Yoma 54a'] };
const FLIGHT = { en: "Steps from the Mount up to a gate of the Azarah. Every step in the Mikdash rose half an amah with a tread of half an amah, except the Ulam's.", sources: ['Middot 2:3'] };
const FLIGHT_NOTE = { en: "The sources give no stair for the northern and southern gates; the difference in level forces one. Its form is the model's.", sources: ['Rambam BhB 6:1–4'] };
const ENC = (s) => ({ en: s, sources: ['Middot 2:5'] });
// the Ezrat Nashim's four corner chambers: forty by forty amot, unroofed (Middot 2:5)
const ENC_MEASURES = [{ label: { en: 'Each side' }, amot: 40, confidence: 'explicit', sources: ['Middot 2:5'] }];
const OPEN = [{ event: 'gates-blasts', label: { en: 'The gates opened with three blasts' } }];
const WATCH = [{ event: 'night-watch', label: { en: 'A Levite on watch here' } }];
const CEILING = { en: "The Heichal's height of a hundred amot, from the bottom up: the otem six, the house forty, then a kiyur course one amah, a beit dilpah two, the tikrah one and the ma'azivah one; the upper storey forty, and again kiyur, beit dilpah, tikrah and ma'azivah; a parapet three, and the kalya orev one.", sources: ['Middot 4:6', 'Rambam BhB 4:3'] };

export const OBJECTS = {
  // ======================================================================== Har HaBayit
  'mount.gate.chuldah-w': {
    title: { en: 'The western Chuldah gate', he: 'שער חולדה' }, aka: ['chuldah', 'huldah', 'chulda gate', 'חולדה'], glossary: "sha'ar chuldah",
    purpose: { en: "Har HaBayit had five gates. The two Chuldah gates, in the south, served for going in and coming out — the south, where the Mount's open space was greatest, saw the most use.", sources: ['Middot 1:3', 'Middot 2:1'] },
    use: MOUNT_GATE_USE, notes: GATE_STD,
    inAction: [{ event: 'entry-circuit', label: { en: 'People come up by the right' } }, ...OPEN, ...WATCH],
    aliases: ['door:mount.gate.chuldah-w'],
  },
  'mount.gate.chuldah-e': {
    title: { en: 'The eastern Chuldah gate', he: 'שער חולדה' }, aka: ['chuldah', 'huldah', 'חולדה'], glossary: "sha'ar chuldah",
    purpose: { en: "Har HaBayit had five gates. The two Chuldah gates, in the south, served for going in and coming out — the south, where the Mount's open space was greatest, saw the most use.", sources: ['Middot 1:3', 'Middot 2:1'] },
    use: MOUNT_GATE_USE, notes: GATE_STD,
    inAction: [{ event: 'entry-circuit', label: { en: 'People leave by the left' } }, ...OPEN, ...WATCH],
    aliases: ['door:mount.gate.chuldah-e'],
  },
  'mount.gate.kiponus': {
    title: { en: 'Kiponus gate', he: 'שער קיפונוס' }, aka: ['kiponus', 'coponius', 'קיפונוס'], glossary: "sha'ar kiponus",
    purpose: { en: "Kiponus, in the west of Har HaBayit, served for going in and coming out.", sources: ['Middot 1:3'] },
    use: MOUNT_GATE_USE, notes: { en: "No source describes how one reached it from the city; the level bridge to it is the model's.", sources: ['Middot 1:3'] },
    inAction: [...OPEN, ...WATCH], aliases: ['door:mount.gate.kiponus'],
  },
  'mount.gate.tadi': {
    title: { en: 'Tadi gate', he: 'שער טדי' }, aka: ['tadi', 'טדי'], glossary: "sha'ar tadi",
    purpose: { en: "Tadi, in the north of Har HaBayit, 'served no purpose'. Its head was not a lintel but two stones leaning one against the other. R' Eliezer ben Yaakov: a kohen who became impure at night went out by the passage under the Chel and left by Tadi.", sources: ['Middot 1:3', 'Middot 2:3', 'Middot 1:9'] },
    use: { en: "A Levite kept watch at it by night, as at every gate of the Mount.", sources: ['Middot 1:1'] },
    inAction: [...OPEN, ...WATCH], aliases: ['door:mount.gate.tadi'],
  },
  'mount.gate.shushan': {
    title: { en: 'The eastern gate (Shushan)', he: 'שער המזרח — שושן הבירה' }, aka: ['shushan', 'shushan gate', 'eastern gate', 'east gate', 'שושן'], glossary: "sha'ar hamizrach",
    purpose: { en: "The eastern gate of Har HaBayit; on it was a depiction of Shushan the capital. Through it the kohen who burns the Parah, the Parah and all who attend her go out to Har HaMishchah.", sources: ['Middot 1:3'] },
    use: { en: "All the walls were high but the eastern one, so that the kohen who burns the Parah, standing on top of Har HaMishchah, could look straight into the entrance of the Heichal as he sprinkled the blood.", sources: ['Middot 2:4', 'Parah 3:9'] },
    notes: GATE_STD, inAction: [...OPEN, ...WATCH], aliases: ['door:mount.gate.shushan'],
  },
  'mount.gate.shushan.chamber': {
    title: { en: 'Shushan HaBirah', he: 'שושן הבירה' }, aka: ['shushan habirah', 'two amot'], glossary: 'shushan habirah',
    purpose: { en: "Over the eastern gate were two standard amot: the one at the north-east corner longer than Moshe's amah by half a fingerbreadth, the one at the south-east longer by another half. Craftsmen took work by the smaller and delivered by the larger, so as not to come to me'ilah.", sources: ['Kelim 17:9', 'Menachot 98a'] },
    notes: { en: "The Mishnah puts the depiction of Shushan on the gate; a chamber over it is the report's and Ezrat Kohanim's reading, drawn here.", sources: ['Middot 1:3'] },
    confidence: 'reconstruction',
  },
  'mount.soreg': {
    title: { en: 'The soreg', he: 'סורג' }, aka: ['soreg', 'lattice', 'fence', 'סורג'], glossary: 'soreg', zone: 'soreg',
    purpose: { en: "A lattice ten tefachim high inside the Mount's open space: the line within which no gentile and no one impure from the dead may go.", sources: ['Middot 2:3', 'Kelim 1:8'] },
    measures: [{ label: { en: 'Height' }, amot: 1.67, confidence: 'explicit', sources: ['Middot 2:3'] }],   // ten tefachim
    notes: { en: "Bartenura reads it as a lattice of slats crossed diagonally; the model stands it at the outer line of the Chel on a one-amah stone base (Ezrat Kohanim's reading; the Rambam's places it apart, near the Mount's walls).", sources: ['Middot 2:3'] },
  },
  'mount.soreg.breaches': {
    title: { en: 'The thirteen breaches', he: 'שלש עשרה פרצות' }, aka: ['breaches', 'pirtzot', 'prostrations', 'פרצות'], zone: 'soreg', zones: ['chel', 'har-habayit'],
    purpose: { en: "The Greek kings breached the soreg in thirteen places. They were fenced up again, and thirteen prostrations were decreed opposite them.", sources: ['Middot 2:3'] },
    notes: { en: "Abba Yosi ben Chanan: the thirteen prostrations were opposite the thirteen gates. The house of Rabban Gamliel and of R' Chananya the segan bowed a fourteenth, opposite the wood chamber, where by their fathers' tradition the Ark was hidden.", sources: ['Middot 2:6', 'Shekalim 6:1–3'] },
    inAction: [{ event: 'entry-circuit', label: { en: 'Prostrating opposite a breach' } }],
  },
  'mount.chel.steps': {
    title: { en: 'The twelve steps of the Chel', he: 'שתים עשרה מעלות שבחיל' }, aka: ['chel steps', 'twelve steps', 'החיל'], glossary: 'chel', zone: 'chel',
    purpose: { en: "Within the soreg was the Chel, ten amot, and twelve steps were there, each half an amah high and half an amah deep. One walked level to the end of the Chel and went up them to the Ezrat Nashim.", sources: ['Middot 2:3', 'Rambam BhB 6:1'] },
    notes: { en: "The Rambam reads 'the Chel, ten amot' as a wall ten amot high; the model draws the Chel as a ten-amah strip.", sources: ['Rambam BhB 5:3'] },
    inAction: [{ event: 'entry-circuit', label: { en: 'Going up into the courts' } }, { event: 'women-court', label: { en: 'Women going up to their court' } }],
  },
  'mount.chamber.parochet': {
    title: { en: 'Lishkat HaParochet', he: 'לשכת הפרכת' }, aka: ['chamber of the curtain', 'parochet chamber'], glossary: 'lishkat haparochet',
    purpose: { en: "The chamber of the curtain: a Levite kept watch at it through the night.", sources: ['Middot 1:1'] },
    notes: { en: "Thirteen curtains hung in the Second Temple; two were made each year, and Elazar was the officer over the curtains. A new curtain was spread on the roof of the colonnade for the people to see its work.", sources: ['Yoma 54a', 'Shekalim 8:5', 'Shekalim 5:1', 'Shekalim 8:4'] },
    inAction: WATCH, confidence: 'reconstruction', confidenceNote: 'Its place is the model\'s.',
  },
  'mount.chamber.korban': {
    title: { en: 'Lishkat HaKorban', he: 'לשכת הקרבן' }, aka: ['chamber of the offering'], glossary: 'lishkat hakorban',
    purpose: { en: "A chamber of the Mount where a Levite kept watch through the night; the Mishnah does not say what it held.", sources: ['Middot 1:1'] },
    inAction: WATCH, confidence: 'reconstruction', confidenceNote: 'Its place is the model\'s.',
  },
  'mount.chamber.beit-haeven': {
    title: { en: 'Beit HaEven', he: 'בית האבן' }, aka: ['stone house', 'beit haeven'], glossary: "beit ha'even",
    purpose: { en: "Seven days before the burning of the Parah the kohen who burns it was separated from his house to a chamber facing the Birah, in the north-east, called Beit HaEven — the stone house — and sprinkled there.", sources: ['Parah 3:1'] },
    notes: { en: "It was called so because all its vessels were of stone, dung and earth, which do not become impure; so too the Kohen Gadol was separated before Yom Kippur.", sources: ['Yoma 2a'] },
  },
  'context.parah-causeway': {
    title: { en: 'The Parah causeway', he: 'כבש הפרה' }, aka: ['causeway', 'parah causeway', 'bridge', 'כבש'], zone: 'parah-causeway',
    purpose: { en: "A causeway from Har HaBayit to Har HaMishchah of arches upon arches, each arch over the pier below, because of a grave in the deep; by it the kohen who burns the Parah, the Parah and all who attend her go out.", sources: ['Parah 3:6'] },
    notes: { en: "It was paid for from the funds left in the chamber (Abba Shaul: the High Priests built it at their own expense).", sources: ['Shekalim 4:2'] },
  },
  'context.parah.pyre': {
    title: { en: 'The place of the Parah burning', he: 'מקום שריפת הפרה' }, aka: ['parah', 'red heifer', 'pyre'], glossary: 'parah adumah',
    purpose: { en: "On Har HaMishchah the wood was laid — cedar, pine, cypress and smooth fig — built like a tower with windows opened in it, its face to the west. The kohen, facing west, sprinkled the blood seven times toward the Kodesh HaKodashim, and the low eastern wall let him see into the Heichal's entrance.", sources: ['Parah 3:8–9', 'Middot 2:4'] },
    notes: { en: "A place of immersion stood there too.", sources: ['Parah 3:7'] },
    aliases: ['parah.pyre'], confidence: 'reconstruction',
  },
  'context.kiponus-approach': {
    title: { en: 'The approach to Kiponus', he: 'מבוא שער קיפונוס' }, aka: ['kiponus bridge'],
    purpose: null,
    notes: { en: "No source describes the way up to Kiponus; it served going in and coming out at the level of the Mount, so the model gives it a level bridge.", sources: ['Middot 1:3'] },
    inAction: [{ event: 'entry-circuit', label: { en: 'People coming up from the city' } }],
  },

  // ======================================================================== Ezrat Nashim
  'en.gate.east': {
    title: { en: 'The east gate of the Ezrat Nashim', he: 'השער היוצא למזרח' }, aka: ['east gate', "women's court gate"],
    purpose: { en: "The gate 'that goes out to the east': on the nights of the Water-Drawing two kohanim with trumpets went down from the Upper Gate, sounding at the tenth step and on the court floor, until they reached it — there they turned west and said 'Our fathers who were in this place… but we — our eyes are toward God'.", sources: ['Sukkah 5:4'] },
    notes: GATE_STD, inAction: [...OPEN, { event: 'women-court', label: { en: 'People coming into the Ezrat Nashim' } }], aliases: ['door:en.gate.east'],
  },
  'en.chamber.nazirites': {
    title: { en: 'Lishkat HaNezirim', he: 'לשכת הנזירים' }, aka: ['nazirites chamber', 'chamber of the nazirites', 'nezirim'], glossary: 'lishkat hanezirim',
    purpose: ENC("The south-east chamber of the Ezrat Nashim, forty by forty amot and unroofed: there the nazirites cook their shelamim, shave their hair and cast it under the pot."),
    use: { en: "At the end of his term the nazir shaves at the entrance and casts the hair into the fire under the pot of his shelamim; a kohen waves the cooked foreleg with a loaf and a wafer on his palms.", sources: ['Nazir 6:8–9', 'Bamidbar 6:18–19'] },
    inAction: [{ event: 'nazirites', label: { en: 'A nazir shaves and cooks his shelamim' } }], measures: ENC_MEASURES, aliases: ['door:en.chamber.nazirites'],
  },
  'en.chamber.wood': {
    title: { en: 'Lishkat HaEtzim', he: 'לשכת העצים' }, aka: ['wood chamber', 'dir haetzim', 'wood store'], glossary: "lishkat ha'etzim",
    purpose: ENC("The north-east chamber of the Ezrat Nashim, unroofed: there kohanim with blemishes picked over the wood for worms — wood with a worm in it is unfit for the altar."),
    notes: { en: "By the tradition of the houses of Rabban Gamliel and of R' Chananya the segan, the Ark was hidden beneath its floor; a kohen once noticed that one paving stone differed from the rest, and died before he could tell. They bowed a fourteenth time opposite it.", sources: ['Shekalim 6:1–2', 'Yoma 54a'] },
    inAction: [{ event: 'wood-chamber', label: { en: 'Blemished kohanim check the wood for worms' } }], measures: ENC_MEASURES, aliases: ['door:en.chamber.wood'],
  },
  'en.chamber.lepers': {
    title: { en: "Lishkat HaMetzora'im", he: 'לשכת המצורעים' }, aka: ['lepers chamber', 'chamber of the lepers', 'metzoraim'], glossary: "lishkat hametzora'im",
    purpose: ENC("The north-west chamber of the Ezrat Nashim, unroofed: the chamber of the metzora'im, where a healed metzora immerses on his eighth day before he comes to Sha'ar Nikanor."),
    notes: { en: "R' Yehudah: not the metzora alone — anyone might immerse there.", sources: ['Negaim 14:8', 'Yoma 30b'] },
    inAction: [{ event: 'metzora', label: { en: 'A healed metzora waits to come to the gate' } }], measures: ENC_MEASURES, aliases: ['door:en.chamber.lepers'],
  },
  'en.chamber.oil': {
    title: { en: 'Lishkat Beit Shamanya', he: 'לשכת בית שמניה' }, aka: ['oil chamber', 'chamber of oils', 'beit shamanya'], glossary: 'lishkat beit shemanya',
    purpose: ENC("The south-west chamber of the Ezrat Nashim. R' Eliezer ben Yaakov said, 'I have forgotten what it was for'; Abba Shaul: there they kept the wine and the oil, and it was called the chamber of Beit Shamanya."),
    measures: ENC_MEASURES, aliases: ['door:en.chamber.oil'],
  },
  'en.chamber.chashaim': {
    title: { en: "Lishkat Chasha'im", he: 'לשכת חשאים' }, aka: ['chamber of secrets', 'secret gifts', 'chashaim'], glossary: "lishkat chasha'im",
    purpose: { en: "The chamber of secrets: those who feared sin put money into it in secret, and the poor of good families were supported from it in secret.", sources: ['Shekalim 5:6'] },
    confidence: 'reconstruction', confidenceNote: 'Its place is the model\'s.', aliases: ['door:en.chamber.chashaim'],
  },
  'en.music-chambers': {
    title: { en: 'The chambers of the instruments', he: 'לשכות כלי השיר' }, aka: ['music chambers', 'instrument stores'],
    purpose: { en: "Chambers under the Ezrat Yisrael, opening onto the Ezrat Nashim, where the Levites kept the kinnorot, the nevalim, the cymbals and all the instruments of song.", sources: ['Middot 2:6'] },
    aliases: ['door:en.music-chambers.n', 'door:en.music-chambers.s'],
  },
  'en.steps15': {
    title: { en: 'The fifteen steps', he: 'חמש עשרה מעלות' }, aka: ['fifteen steps', '15 steps', 'semicircular steps', 'מעלות'], glossary: "chamesh-esreh ma'alot",
    purpose: { en: "Fifteen steps went up from the Ezrat Nashim to the Ezrat Yisrael, corresponding to the fifteen Songs of Ascents in Tehillim, on which the Levites sang. They were not square-cornered but rounded like half a round threshing floor.", sources: ['Middot 2:5'] },
    use: { en: "On the nights of the Water-Drawing the Levites stood on them with kinnorot, nevalim, cymbals and trumpets without number. Gevini the crier called from here each dawn.", sources: ['Sukkah 5:4', 'Yoma 20b'] },
    inAction: [{ event: 'gevini', label: { en: 'Gevini the crier calls' } }, { event: 'impure-east-gate', label: { en: 'The impure stand at the head of the steps' } }, { event: 'gate-levites', label: { en: 'Levites keep the gate' } }],
  },
  'en.gallery': {
    title: { en: 'The gallery (gezuztra)', he: 'גזוזטרא' }, aka: ['gallery', 'gezuztra', "women's gallery"], glossary: 'gezuztra',
    purpose: { en: "The court was at first flat; they surrounded it with a gallery, so that the women watched from above and the men below and they would not mingle — at the Water-Drawing of Sukkot.", sources: ['Middot 2:5', 'Sukkah 51b'] },
    confidence: 'reconstruction',
  },
  'en.shofarot': {
    title: { en: 'The thirteen shofarot', he: 'שלשה עשר שופרות' }, aka: ['shofarot', 'chests', 'alms chests', 'collection chests', 'kinnin chest', 'שופרות'],
    zone: 'ezrat-nashim', pickBox: { min: [282, 342.3, 6], max: [289.3, 348.7, 9] },
    purpose: { en: "Thirteen chests narrow at the top like a horn stood in the Mikdash, inscribed: new shekels, old shekels, bird pairs (kinnin), birds for olot, wood, frankincense, gold for the kaporet, and six for free-will offerings.", sources: ['Shekalim 6:1', 'Shekalim 6:5'] },
    use: { en: "One who vows wood gives no less than two logs; frankincense, no less than a handful; gold, no less than a gold dinar. With the free-will money olot were bought — the meat to God, the hides to the kohanim.", sources: ['Shekalim 6:6'] },
    notes: { en: "Their place is not given; the model sets them in the Ezrat Nashim by the steps, where a mother after childbirth may still put in her money.", sources: ['Shekalim 6:5'] },
    confidence: 'reconstruction',
  },

  // ======================================================================== Nikanor and the east of the Azarah
  'azarah.gate.nikanor': {
    title: { en: "Sha'ar Nikanor", he: 'שער ניקנור' }, aka: ['nikanor', 'nicanor', 'upper gate', 'eastern gate of the azarah', 'ניקנור', 'נקנור'], glossary: "sha'ar nikanor",
    purpose: { en: "The east gate of the Azarah, at the head of the fifteen steps, opposite the Heichal. When all the gates were plated with gold, Nikanor's were left: a miracle had been done with them — and some say, because their bronze gleamed like gold.", sources: ['Middot 1:4', 'Middot 2:3', 'Yoma 38a'] },
    use: { en: "Its gateway was left without the court's sanctity: there the healed metzora stood on his eighth day for the blood and the oil, mothers after childbirth were purified and the sotah was given the water; at the magrefah's crash the head of the ma'amad stationed the impure at the eastern gate. A chamber stood at each side — of Pinchas the dresser and of the chavitin makers.", sources: ['Sotah 1:5', 'Yoma 30b–31a', 'Tamid 5:6', 'Middot 1:4'] },
    notes: { en: "Nikanor brought its doors from Alexandria; in a storm one was thrown overboard and came up at Akko under the ship. R' Eliezer ben Yaakov: they were of Corinthian bronze. Two wickets flanked it, one at its right and one at its left.", sources: ['Yoma 38a', 'Middot 2:6'] },
    inAction: [...OPEN, { event: 'metzora', label: { en: 'A metzora at the gate for the blood and the oil' } }, { event: 'nikanor-purifications', label: { en: 'Mothers and the healed stand in the gateway' } }, { event: 'impure-east-gate', label: { en: 'The impure stationed at the gate' } }, { event: 'gate-levites', label: { en: 'Levites at the gate' } }],
    aliases: ['door:azarah.gate.nikanor', 'curtain:azarah.gate.nikanor'],
  },
  'azarah.gate.nikanor.wicket-n': {
    title: { en: "Nikanor's north wicket", he: 'פשפש של שער ניקנור' }, aka: ['wicket', 'pishpash'], glossary: 'pishpash',
    purpose: { en: "Sha'ar Nikanor had two wickets, one at its right and one at its left.", sources: ['Middot 2:6', 'Shekalim 6:3'] },
    notes: { en: "Their size and form are not given; Ezrat Kohanim reads them as the doors of the two chambers beside the gate. Drawn here as small doors in the wall.", sources: ['Middot 1:4'] },
    aliases: ['door:azarah.gate.nikanor.wicket-n'],
  },
  'azarah.gate.nikanor.wicket-s': {
    title: { en: "Nikanor's south wicket", he: 'פשפש של שער ניקנור' }, aka: ['wicket', 'pishpash'], glossary: 'pishpash',
    purpose: { en: "Sha'ar Nikanor had two wickets, one at its right and one at its left.", sources: ['Middot 2:6', 'Shekalim 6:3'] },
    aliases: ['door:azarah.gate.nikanor.wicket-s'],
  },
  'azarah.chamber.pinchas': {
    title: { en: 'Lishkat Pinchas HaMalbish', he: 'לשכת פנחס המלביש' }, aka: ['vestments chamber', 'pinchas the dresser'], glossary: 'lishkat pinchas hamalbish',
    purpose: { en: "One of the two chambers beside Sha'ar Nikanor: the chamber of Pinchas the dresser, the officer over the garments.", sources: ['Middot 1:4', 'Shekalim 5:1'] },
    aliases: ['door:azarah.chamber.pinchas.door'],
  },
  'azarah.chamber.chavitin': {
    title: { en: "Lishkat Osei Chavitin", he: 'לשכת עושי חביתין' }, aka: ['chavitin chamber', 'chamber of the chavitin makers', 'bakers'], glossary: 'lishkat osei chavitin',
    purpose: { en: "The other chamber beside Sha'ar Nikanor: of those who made the chavitin, the Kohen Gadol's daily meal-offering, made on a griddle with oil.", sources: ['Middot 1:4', 'Vayikra 6:13–14'] },
    use: { en: "The two companies of the dawn inspection went round the Azarah, one by the east and one by the west, until they met at the place of the chavitin makers: 'Shalom — all is well'. Then the chavitin makers were set to work.", sources: ['Tamid 1:3'] },
    inAction: [{ event: 'torch-inspection', label: { en: '"All is well": the bakers are set to work' } }, { event: 'chavitin-bakers', label: { en: 'The chavitin are made' } }],
    aliases: ['door:azarah.chamber.chavitin.door'],
  },
  'azarah.duchan': {
    title: { en: 'The duchan', he: 'הדוכן' }, aka: ['duchan', 'levites platform', 'platform', 'דוכן'], glossary: 'duchan',
    purpose: { en: "R' Eliezer ben Yaakov: between the Ezrat Yisrael and the Ezrat Kohanim was a step one amah high with the duchan on it, of three steps of half an amah, so that the Ezrat Kohanim stood two and a half amot higher. The Levites stood on the duchan to sing over the offerings — never fewer than twelve.", sources: ['Middot 2:6', 'Arachin 2:6', 'Rambam BhB 6:3'] },
    use: { en: "As the wine is poured the segan waves the flags, Ben Arza strikes the cymbal and the Levites sing the day's psalm in three sections; at each break the trumpets sound and the people prostrate.", sources: ['Tamid 7:3–4'] },
    inAction: [{ event: 'song-weekday', label: { en: 'The song of the day' } }, { event: 'song-friday', label: { en: 'The song of the sixth day' } }, { event: 'song-shabbat', label: { en: 'The Shabbat song' } }, { event: 'afternoon-song', label: { en: 'The afternoon song' } }, { event: 'afternoon-song-shabbat', label: { en: 'Shabbat afternoon: the Song at the Sea' } }],
  },

  // ======================================================================== the gates of the Azarah
  'azarah.gate.delek': {
    title: { en: "Sha'ar HaDelek", he: 'שער הדלק' }, aka: ['delek', 'gate of kindling', 'fuel gate'], glossary: "sha'ar hadelek",
    purpose: { en: "One of the seven gates of the Azarah: of the three in the south, the first from the west was Sha'ar HaDelek. The Mishnah gives only its name.", sources: ['Middot 1:4'] },
    use: COURT_GATE_USE, notes: GATE_STD, inAction: [...OPEN, ...WATCH], aliases: ['door:azarah.gate.delek', 'curtain:azarah.gate.delek'],
  },
  'azarah.gate.bechorot': {
    title: { en: "Sha'ar HaBechorot", he: 'שער הבכורות' }, aka: ['bechorot', 'gate of the firstborn', 'firstlings gate'], glossary: "sha'ar habechorot",
    purpose: { en: "The second gate in the south of the Azarah, Sha'ar HaBechorot — Bartenura: by it the firstborn animals were brought in for their slaughter.", sources: ['Middot 1:4'] },
    use: COURT_GATE_USE, notes: GATE_STD, inAction: [...OPEN, ...WATCH], aliases: ['door:azarah.gate.bechorot', 'curtain:azarah.gate.bechorot'],
  },
  'azarah.gate.mayim': {
    title: { en: "Sha'ar HaMayim (the Water Gate)", he: 'שער המים' }, aka: ['water gate', 'mayim', 'שער המים'], glossary: "sha'ar hamayim",
    purpose: { en: "The third gate in the south of the Azarah. Why the Water Gate? Because by it they bring in the flask of water for the libation on Sukkot. R' Eliezer ben Yaakov: by it the water trickles, and it will one day come out from under the threshold of the House.", sources: ['Middot 1:4', 'Middot 2:6', 'Shekalim 6:3'] },
    use: { en: "Beit Avtinas, where the incense was compounded, was an upper chamber over it, and kohanim kept watch there by night. On its roof was the mikveh of the Kohen Gadol's first immersion on Yom Kippur.", sources: ['Tamid 1:1', 'Middot 1:1', 'Yoma 19a', 'Yoma 31a'] },
    notes: GATE_STD,
    inAction: [{ event: 'barkai', label: { en: '"Barkai!" — the watcher (shown on its roof; where he stood is not recorded)' }, focus: 'event' }, { event: 'friday-blasts-work', label: { en: 'Friday: the blasts to stop work (shown from its roof)' }, focus: 'event' }, ...OPEN, ...WATCH],
    aliases: ['door:azarah.gate.mayim', 'curtain:azarah.gate.mayim'],
  },
  'azarah.gate.mayim.house': {
    title: { en: 'The Water Gate gatehouse', he: 'בית שער המים' }, aka: ['water gate house', 'gatehouse'],
    purpose: { en: "The gatehouses of the Azarah were of marble with thin ceilings. Over the Water Gate was the upper chamber of Beit Avtinas.", sources: ['Yoma 31b', 'Tamid 1:1'] },
    notes: { en: "The newel stair inside it, by which the roof is reached, is the model's.", sources: ['Yoma 31a'] },
    inAction: [{ event: 'barkai', label: { en: 'The watcher climbs to the roof' } }], confidence: 'reconstruction',
  },
  'azarah.mikveh.mayim-roof': {
    title: { en: 'The mikveh on the Water Gate', he: 'מקוה על גבי שער המים' }, aka: ['mikveh', 'kohen gadol mikveh', 'roof mikveh'], glossary: 'mikveh',
    purpose: { en: "The Kohen Gadol's first immersion on Yom Kippur was on the roof of the Water Gate, in unsanctified ground, beside his chamber; the spring of Eitam stood twenty-three amot above the floor of the Azarah to fill it.", sources: ['Yoma 31a', 'Yoma 19a'] },
    notes: { en: "A mikveh holds forty se'ah — water in which all his body goes up: an amah by an amah by three amot.", sources: ['Yoma 31a'] },
    aliases: ['curtain:azarah.mikveh.mayim-roof.screen'], confidence: 'reconstruction',
  },
  'azarah.beit-avtinas': {
    title: { en: 'Beit Avtinas', he: 'בית אבטינס' }, aka: ['avtinas', 'incense chamber', 'beit avtinas', 'אבטינס'], glossary: 'beit avtinas',
    purpose: { en: "An upper chamber over the Water Gate, the house of Avtinas, who compounded the incense; young kohanim kept watch there at night, one of the three posts of the kohanim.", sources: ['Tamid 1:1', 'Middot 1:1', 'Shekalim 5:1', 'Yoma 19a'] },
    use: { en: "The house of Avtinas would not teach the secret of the smoke-raiser; as one ground the spices he said 'Grind it fine — fine, grind it', for the voice is good for the spices. On the eve of Yom Kippur the elders took the Kohen Gadol up to it and adjured him.", sources: ['Yoma 38a', 'Keritot 6b', 'Yoma 1:5', 'Yoma 19a'] },
    inAction: [{ event: 'watch-upper-chambers', label: { en: 'Young kohanim asleep on watch' } }, { event: 'avtinas-compounding', label: { en: 'Compounding the incense' } }],
    aliases: ['door:azarah.beit-avtinas'],
  },
  'azarah.gate.nitzotz': {
    title: { en: "Sha'ar HaNitzotz", he: 'שער הניצוץ' }, aka: ['nitzotz', 'gate of the spark'], glossary: "sha'ar hanitzotz",
    purpose: { en: "The first gate in the north of the Azarah. It was like an exedra with an upper storey built over it: the kohanim kept watch above and the Levites below, and it had a door to the Chel.", sources: ['Middot 1:5'] },
    use: COURT_GATE_USE, notes: GATE_STD, inAction: [...OPEN, ...WATCH], aliases: ['door:azarah.gate.nitzotz', 'curtain:azarah.gate.nitzotz'],
  },
  'azarah.gate.nitzotz.exedra': {
    title: { en: "The exedra of Sha'ar HaNitzotz", he: 'אכסדרה של שער הניצוץ' }, aka: ['exedra', 'achsadra'], glossary: 'achsadra',
    purpose: { en: "Sha'ar HaNitzotz was like an exedra with an upper storey: the kohanim kept watch above, the Levites below; it had a door to the Chel.", sources: ['Middot 1:5'] },
    inAction: WATCH,
  },
  'azarah.beit-hanitzotz': {
    title: { en: 'Beit HaNitzotz', he: 'בית הניצוץ' }, aka: ['nitzotz chamber', 'upper chamber'], glossary: 'beit hanitzotz',
    purpose: { en: "The upper storey over Sha'ar HaNitzotz, one of the three places where the kohanim kept watch: young kohanim (rovim) slept there on watch.", sources: ['Tamid 1:1', 'Middot 1:1', 'Middot 1:5'] },
    inAction: [{ event: 'watch-upper-chambers', label: { en: 'Young kohanim asleep on watch' } }],
  },
  'azarah.gate.korban': {
    title: { en: "Sha'ar HaKorban", he: 'שער הקרבן' }, aka: ['korban gate', 'gate of the offering'], glossary: "sha'ar hakorban",
    purpose: { en: "The second gate in the north of the Azarah — Bartenura: by it the most-holy offerings, slaughtered in the north, were brought in.", sources: ['Middot 1:5'] },
    use: COURT_GATE_USE, notes: GATE_STD,
    inAction: [{ event: 'private-offerings', label: { en: 'Owners lead their animals in' } }, { event: 'nazirites', label: { en: 'A nazir comes in with his three animals' } }, ...OPEN, ...WATCH],
    aliases: ['door:azarah.gate.korban', 'curtain:azarah.gate.korban'],
  },
  'azarah.gate.moked': {
    title: { en: "The gate of Beit HaMoked", he: 'שער בית המוקד' }, aka: ['moked gate', 'pishpash', 'wicket'], glossary: "sha'ar beit hamoked",
    purpose: { en: "Beit HaMoked had two doors, one opening to the Chel and one to the Azarah. R' Yehudah: the one to the Azarah had a small wicket, by which they went in to inspect the court.", sources: ['Middot 1:7', 'Middot 1:5'] },
    use: { en: "Before dawn the officer took the key, opened the wicket and went from Beit HaMoked into the Azarah, the kohanim after him with two burning torches. The lamb for the tamid was brought from the lamb chamber of Beit HaMoked.", sources: ['Tamid 1:3', 'Tamid 3:3'] },
    inAction: [{ event: 'torch-inspection', label: { en: 'The wicket opened for the inspection' } }, { event: 'lamb-brought', label: { en: 'A lamb brought out' } }, ...OPEN],
    aliases: ['door:azarah.gate.moked', 'door:azarah.gate.moked.pishpash', 'curtain:azarah.gate.moked'],
  },

  // ======================================================================== chambers of the Azarah
  'azarah.chamber.kelim': {
    title: { en: 'Lishkat HaKelim', he: 'לשכת הכלים' }, aka: ['chamber of vessels', 'vessels chamber', 'kelim'], glossary: 'lishkat hakelim',
    purpose: { en: "Whoever gave a vessel threw it into the chamber of vessels; once in thirty days the treasurers opened it, kept what the House needed and sold the rest. From it the ninety-three vessels of silver and gold were brought out each morning.", sources: ['Shekalim 5:6', 'Tamid 3:4'] },
    inAction: [{ event: 'vessels', label: { en: 'Ninety-three vessels brought out' } }], aliases: ['door:azarah.chamber.kelim'], confidence: 'reconstruction', confidenceNote: 'Its place is the model\'s.',
  },
  'azarah.chamber.gazit': {
    title: { en: 'Lishkat HaGazit', he: 'לשכת הגזית' }, aka: ['gazit', 'chamber of hewn stone', 'hall of hewn stone', 'גזית'], glossary: 'lishkat hagazit',
    purpose: { en: "There the Great Sanhedrin of Israel sat and judged the priesthood: a kohen found unfit put on black and went out; one found fit put on white and went in to serve with his brothers.", sources: ['Middot 5:4'] },
    use: { en: "Half of it was in the holy court and half outside, with two doors; the Sanhedrin sat in the outer half, for no one sits in the Azarah. In it the kohanim cast the daily lots and read the Shema: the lottery in its east, the elder in its west.", sources: ['Yoma 25a', 'Tamid 3:1', 'Tamid 4:3–5:1'] },
    notes: { en: "The printed Mishnah counts it among the three chambers of the south; Yoma 19a and the Rambam, whom the model follows, put it in the north.", sources: ['Middot 5:4', 'Yoma 19a', 'Rambam BhB 5:17'] },
    inAction: [{ event: 'second-lottery', label: { en: 'The second lottery: thirteen tasks' } }, { event: 'gazit-shema', label: { en: 'The Shema and the blessings' } }, { event: 'third-fourth-lottery', label: { en: 'The third and fourth lotteries' } }, { event: 'sanhedrin', label: { en: 'The Sanhedrin in session' } }],
    aliases: ['door:azarah.chamber.gazit.east', 'door:azarah.chamber.gazit.west'],
  },
  'azarah.chamber.gazit.podium': {
    title: { en: "The base of Lishkat HaGazit", he: 'יסוד לשכת הגזית' },
    purpose: null, notes: { en: "The half of Lishkat HaGazit outside the court stands over the Chel; the substructure under it is the model's.", sources: ['Yoma 25a'] },
    confidence: 'reconstruction',
  },
  'azarah.chamber.gazit.flight': {
    title: { en: "Steps of Lishkat HaGazit", he: 'מעלות לשכת הגזית' },
    purpose: { en: "Lishkat HaGazit had two doors, one to the holy court and one to the unsanctified side, by which the judges came in.", sources: ['Yoma 25a'] }, notes: FLIGHT_NOTE,
    inAction: [{ event: 'sanhedrin', label: { en: 'The judges come up to the session' } }],
  },
  'azarah.chamber.golah': {
    title: { en: 'Lishkat HaGolah', he: 'לשכת הגולה' }, aka: ['golah', 'cistern', 'wheel', 'golah wheel', 'galgal'], glossary: 'lishkat hagolah',
    purpose: { en: "There was a cistern there with the wheel set over it, and from it they supplied water to the whole Azarah.", sources: ['Middot 5:4'] },
    use: { en: "It was turned to draw water even on Shabbat.", sources: ['Eruvin 10:14'] },
    inAction: [{ event: 'golah-wheel', label: { en: 'Levites turn the wheel' } }], aliases: ['door:azarah.chamber.golah', 'wheel:azarah.chamber.golah'],
  },
  'azarah.chamber.etz': {
    title: { en: 'Lishkat HaEtz (Parhedrin)', he: 'לשכת העץ — לשכת פרהדרין' }, aka: ['parhedrin', 'chamber of wood', 'kohen gadol chamber', 'etz'], glossary: "lishkat ha'etz",
    purpose: { en: "R' Eliezer ben Yaakov: 'I have forgotten what it was for'; Abba Shaul: it was the chamber of the Kohen Gadol. It lay behind the other two, and the roof of all three was level.", sources: ['Middot 5:4'] },
    use: { en: "Seven days before Yom Kippur the Kohen Gadol was separated from his house to Lishkat Parhedrin; it was the only chamber in the Mikdash with a mezuzah.", sources: ['Yoma 1:1', 'Yoma 10a'] },
    notes: { en: "Yoma 19a infers that it lay in the south, beside the Water Gate; the model keeps it in the north with the Rambam's arrangement.", sources: ['Yoma 19a', 'Rambam BhB 5:17'] },
    aliases: ['door:azarah.chamber.etz'],
  },
  'azarah.chamber.etz.flight': {
    title: { en: 'Steps of Lishkat Parhedrin', he: 'מעלות לשכת פרהדרין' }, purpose: FLIGHT, notes: FLIGHT_NOTE,
  },
  'azarah.chamber.melach': {
    title: { en: 'Lishkat HaMelach', he: 'לשכת המלח' }, aka: ['salt chamber', 'chamber of salt', 'melach'], glossary: 'lishkat hamelach',
    purpose: { en: "The chamber of salt: there they put salt for the offerings.", sources: ['Middot 5:3'] },
    notes: { en: "The printed Mishnah counts it among the chambers of the north; Yoma 19a and the Rambam, whom the model follows, put this trio in the south.", sources: ['Middot 5:3', 'Yoma 19a', 'Rambam BhB 5:17'] },
    inAction: [{ event: 'parvah', label: { en: 'Salt fetched for the hides' } }], aliases: ['door:azarah.chamber.melach'],
  },
  'azarah.chamber.parvah': {
    title: { en: 'Lishkat HaParvah', he: 'לשכת הפרוה' }, aka: ['hides chamber', 'parvah'], glossary: 'lishkat haparvah',
    purpose: { en: "There they salted the hides of the offerings, and on its roof was the immersion house of the Kohen Gadol on Yom Kippur.", sources: ['Middot 5:3'] },
    notes: { en: "Four of his five immersions that day were there, in holy ground, behind a linen sheet.", sources: ['Yoma 3:3–4', 'Yoma 31a'] },
    inAction: [{ event: 'parvah', label: { en: 'Salting the hides' } }], aliases: ['door:azarah.chamber.parvah', 'curtain:azarah.chamber.parvah.screen'],
  },
  'azarah.chamber.medichin': {
    title: { en: 'Lishkat HaMedichin', he: 'לשכת המדיחין' }, aka: ['rinsers chamber', 'medichin'], glossary: 'lishkat hamedichin',
    purpose: { en: "There they rinsed the innards of the offerings, and from it a winding stair went up to the roof of the Parvah.", sources: ['Middot 5:3'] },
    use: { en: "The stomach of the tamid was rinsed in the rinsers' chamber as much as it needed.", sources: ['Tamid 4:2'] },
    inAction: [{ event: 'flaying', label: { en: 'The stomach rinsed' } }], aliases: ['door:azarah.chamber.medichin'],
  },

  // ======================================================================== Beit HaMoked
  'azarah.moked.hall': {
    title: { en: 'Beit HaMoked', he: 'בית המוקד' }, aka: ['moked', 'hearth house', 'chamber of the hearth', 'dome', 'ledges', 'rovadin'], glossary: 'beit hamoked',
    purpose: { en: "Beit HaMoked was domed — a large house, surrounded by ledges of stone; the elders of the beit av slept there with the keys of the Azarah in their hands, and the young kohanim each on his mat on the floor. It was one of the three posts of the kohanim's watch.", sources: ['Middot 1:8', 'Tamid 1:1', 'Middot 1:1'] },
    use: { en: "They did not sleep in the holy garments but folded them under their heads. The officer came and knocked, and they opened to him: 'Whoever has immersed, come and cast lots!' Four chambers opened off it like small rooms off a hall, two in the holy part and two outside, rashei pispasin marking the line.", sources: ['Tamid 1:1–2', 'Middot 1:6'] },
    inAction: [{ event: 'moked-night', label: { en: 'Night in Beit HaMoked' } }, { event: 'memuneh-knock', label: { en: 'The officer knocks' } }, { event: 'first-lottery', label: { en: 'The first lottery round the hearth' } }, { event: 'locking-up', label: { en: 'The gates are locked' } }],
  },
  'azarah.moked.podium': {
    title: { en: 'The base of Beit HaMoked', he: 'יסוד בית המוקד' }, purpose: null,
    notes: { en: "Beit HaMoked stood between the Azarah and the Chel; the substructure of its outer part is the model's.", sources: ['Rambam BhB 5:9'] }, confidence: 'reconstruction',
  },
  'azarah.moked.keys-slab': {
    title: { en: 'The keys slab', he: 'טבלא של שיש' }, aka: ['keys', 'keys slab', 'marble slab', 'ring and chain'],
    purpose: { en: "There was a place an amah by an amah with a marble tablet and a ring fixed in it, and a chain on which the keys hung. At the time of locking the kohen lifted the tablet by the ring, took the keys from the chain and locked from within, a Levite sleeping outside; then he put the keys back on the chain and the tablet in its place, spread his garment over it and slept on it.", sources: ['Middot 1:9'] },
    use: { en: "Before dawn the officer took the key and opened the wicket into the Azarah.", sources: ['Tamid 1:3'] },
    inAction: [{ event: 'locking-up', label: { en: 'The keys taken from under the slab' } }, { event: 'torch-inspection', label: { en: 'The key taken for the inspection' } }],
    aliases: ['azarah.moked.keys-slab'],
  },
  'azarah.moked.door-chel': {
    title: { en: "Beit HaMoked's door to the Chel", he: 'פתח בית המוקד לחיל' }, aka: ['moked door'],
    purpose: { en: "Of Beit HaMoked's two doors, one opened to the Chel.", sources: ['Middot 1:7'] },
    use: { en: "The officer came and knocked on them, and they opened to him.", sources: ['Tamid 1:2'] },
    inAction: [{ event: 'memuneh-knock', label: { en: 'The officer knocks' } }], aliases: ['door:azarah.moked.door-chel'],
  },
  'azarah.moked.flight': {
    title: { en: "Beit HaMoked's steps to the Chel", he: 'מעלות בית המוקד' }, purpose: FLIGHT, notes: FLIGHT_NOTE,
    inAction: [{ event: 'memuneh-knock', label: { en: 'The officer comes up to knock' } }],
  },
  'azarah.moked.chamber.lambs': {
    title: { en: 'The lamb chamber', he: 'לשכת טלאי קרבן' }, aka: ['lambs chamber', 'lamb chamber'], glossary: "lishkat t'la'ei korban",
    purpose: { en: "Of the four chambers of Beit HaMoked, the south-western was the chamber of the lambs for the offering.", sources: ['Middot 1:6'] },
    use: { en: "'Go out and bring a lamb from the lamb chamber.' No fewer than six inspected lambs were kept there.", sources: ['Tamid 3:3', 'Arachin 2:5'] },
    notes: { en: "Tamid 3:3 places it in the north-west; the Gemara harmonises the two counts.", sources: ['Tamid 3:3', 'Yoma 17a'] },
    inAction: [{ event: 'lamb-brought', label: { en: 'A lamb brought from the chamber' } }], aliases: ['door:azarah.moked.chamber.lambs'],
  },
  'azarah.moked.chamber.showbread': {
    title: { en: 'The chamber of the showbread makers', he: 'לשכת עושי לחם הפנים' }, aka: ['beit garmu', 'showbread bakery'], glossary: 'beit garmu',
    purpose: { en: "The south-eastern chamber of Beit HaMoked: there they made the showbread.", sources: ['Middot 1:6', 'Tamid 3:3'] },
    use: { en: "The house of Garmu was over the making of the showbread and would not teach its craft.", sources: ['Shekalim 5:1', 'Yoma 3:11'] },
    inAction: [{ event: 'beit-garmu', label: { en: 'Friday: the showbread baked' } }], aliases: ['door:azarah.moked.chamber.showbread'],
  },
  'azarah.moked.chamber.altar-stones': {
    title: { en: 'The chamber of the altar stones', he: 'לשכה שגנזו בה את אבני המזבח' }, aka: ['altar stones', 'seals chamber', 'chotamot'], glossary: 'lishkat hachotamot',
    purpose: { en: "In the north-eastern chamber of Beit HaMoked the Hasmoneans hid away the stones of the altar that the Greek kings had defiled.", sources: ['Middot 1:6'] },
    notes: { en: "Tamid's list of the four chambers has a chamber of seals among them; the model sets the evening reckoning of the seals before this one.", sources: ['Tamid 3:3', 'Shekalim 5:4'] },
    inAction: [{ event: 'seals', label: { en: 'The evening reckoning of the seals' } }], aliases: ['door:azarah.moked.chamber.altar-stones'],
  },
  'azarah.moked.chamber.tevilah-descent': {
    title: { en: 'The descent to the Beit HaTevilah', he: 'לשכה שבה יורדין לבית הטבילה' }, aka: ['descent', 'mesibah'],
    purpose: { en: "The north-western chamber of Beit HaMoked: by it they went down to the Beit HaTevilah.", sources: ['Middot 1:6'] },
    inAction: [{ event: 'mesibah-keri', label: { en: 'A kohen goes down to immerse' } }, { event: 'dawn-immersion', label: { en: 'Rising early to immerse' } }],
    aliases: ['door:azarah.moked.chamber.tevilah-descent'],
  },
  'azarah.underground.stair': {
    title: { en: 'The winding stair down', he: 'מסיבה' }, aka: ['mesibah', 'winding stair', 'tunnel'], glossary: 'mesibah',
    purpose: { en: "A kohen who became impure at night went out by the winding passage that runs under the Birah, the lamps burning on both sides, until he reached the Beit HaTevilah.", sources: ['Tamid 1:1', 'Middot 1:9'] },
    inAction: [{ event: 'mesibah-keri', label: { en: 'Down the passage by lamplight' } }],
  },
  'azarah.underground.beit-hatevilah': {
    title: { en: 'Beit HaTevilah', he: 'בית הטבילה' }, aka: ['immersion house', 'mikveh', 'medurah', 'privy of honour'], glossary: 'beit hatevilah',
    purpose: { en: "The immersion house under the Birah: a fire burned there, and there was a privy of honour — its honour was that if it was found locked, one knew someone was inside. He went down and immersed, came up, dried himself and warmed himself by the fire.", sources: ['Tamid 1:1', 'Middot 1:9'] },
    use: { en: "Whoever wants to clear the altar rises early and immerses before the officer comes.", sources: ['Tamid 1:2'] },
    inAction: [{ event: 'mesibah-keri', label: { en: 'Immersing and warming at the fire' } }, { event: 'dawn-immersion', label: { en: 'Rising early to immerse' } }], aliases: ['door:azarah.underground.privy'],
  },

  // ======================================================================== the Mizbeach
  'altar.yesod': {
    title: { en: 'The yesod of the Mizbeach', he: 'יסוד המזבח' }, aka: ['yesod', 'base', 'altar base'], glossary: 'yesod',
    purpose: { en: "The altar was thirty-two amot by thirty-two: it rose one amah and went in one amah — this is the yesod. It ran the whole length of the north and the west but took only one amah on the south and one on the east.", sources: ['Middot 3:1'] },
    use: { en: "The remainder of the tamid's blood is poured on the southern yesod; the bloods given on the western and southern yesod run down two holes at the south-west horn into the channel and out to the Kidron.", sources: ['Tamid 4:1', 'Middot 3:2'] },
    inAction: [{ event: 'tamid-blood', label: { en: 'The rest of the blood on the southern yesod' } }, { event: 'altar-blood', label: { en: 'Blood on the altar' } }],
  },
  'altar.body': {
    title: { en: 'The Mizbeach', he: 'המזבח' }, aka: ['mizbeach', 'altar', 'outer altar', 'mizbach haolah', 'מזבח'], glossary: 'mizbeach',
    purpose: { en: "The altar of burnt-offering: thirty-two amot square at its base, it rose five amot above the yesod and went in an amah — this is the sovev — then to the top. Its stones came from the virgin ground of the valley of Beit Kerem, whole stones on which iron was never lifted.", sources: ['Middot 3:1', 'Middot 3:4'] },
    use: { en: "It was whitewashed twice a year, at Pesach and at Sukkot, never with an iron trowel: 'iron was created to shorten man's days and the altar to lengthen them'.", sources: ['Middot 3:4'] },
    measures: [
      { label: { en: 'At its base, with the yesod' }, amot: 32, confidence: 'explicit', sources: ['Middot 3:1'] },
      { label: { en: 'Above the yesod (to the sovev)' }, amot: 30, confidence: 'explicit', sources: ['Middot 3:1'] },
      { label: { en: 'The place of the pyre, on top' }, amot: 24, confidence: 'explicit', sources: ['Middot 3:1'] },
      { label: { en: 'Height, with the horns' }, amot: 10, confidence: 'explicit', sources: ['Rambam BhB 2:5–6'] },
    ],
    notes: { en: "R' Yosi: at first it was twenty-eight by twenty-eight; those who came up from Babylon added four amot on the south and four on the west, like a gamma.", sources: ['Middot 3:1', 'Zevachim 61b–62a'] },
    inAction: [{ event: 'terumat-hadeshen', label: { en: 'Terumat hadeshen' } }, { event: 'altar-limbs', label: { en: 'Limbs and fats on the fire' } }, { event: 'fats-burning', label: { en: 'The fire through the night' } }],
  },
  'altar.top': {
    title: { en: 'The top of the Mizbeach', he: 'ראש המזבח' }, aka: ['altar top', 'maarachah', 'pyre', 'tapuach', 'great pile', 'two logs'], glossary: "ma'arachah",
    purpose: { en: "The place of the horns took an amah on each side, and the walking-place of the kohanim another: there remained twenty-four by twenty-four amot, the place of the pyre (ma'arachah).", sources: ['Middot 3:1'] },
    use: { en: "In the middle stood the ash heap, the tapuach — at times three hundred kor. Each morning the great pile was built on the east with its face east, the second pile for the incense opposite the south-west horn, four amot to the north; the limbs not consumed in the night were pushed to the sides and put back. Any wood but olive and vine; fig, walnut and oil-tree were the custom.", sources: ['Tamid 2:2–5'] },
    inAction: [{ event: 'terumat-hadeshen', label: { en: 'The ashes taken up' } }, { event: 'tapuach', label: { en: 'The ashes raised onto the tapuach' } }, { event: 'great-pile', label: { en: 'The great pile built' } }, { event: 'second-pile', label: { en: 'The incense pile and the two logs' } }, { event: 'limbs-up', label: { en: 'The limbs thrown on the fire' } }, { event: 'evening-altar', label: { en: "The day's last fats and limbs" } }],
    aliases: ['altar.maarachah.great.pile', 'altar.tapuach', 'altar.two-logs'],
  },
  'altar.sovev': {
    title: { en: 'The sovev', he: 'סובב' }, aka: ['sovev', 'circuit', 'ledge', 'karkov'], glossary: 'sovev',
    purpose: { en: "Five amot above the yesod the altar went in an amah: this is the sovev, the ledge round it.", sources: ['Middot 3:1'] },
    use: { en: "The kohen with an olat ha'of goes up the ramp, turns to the sovev and comes to the south-east horn; the blood of a chatat is put on the four horns from it.", sources: ['Zevachim 6:5', 'Zevachim 5:3'] },
    measures: [
      { label: { en: 'Width of the ledge' }, amot: 1, confidence: 'explicit', sources: ['Middot 3:1'] },
      { label: { en: 'Above the ground' }, amot: 6, confidence: 'explicit', sources: ['Middot 3:1'] },
    ],
    notes: { en: "The karkov is the sovev according to R' Yosi son of R' Yehudah; Rebbi: an ornamental band; Rav Nachman: there were two, one for beauty and one so the kohanim would not slip.", sources: ['Zevachim 62a'] },
    inAction: [{ event: 'bird-offerings', label: { en: 'Birds at the corners' } }, { event: 'altar-blood', label: { en: 'Blood on the four horns' } }],
  },
  'altar.keren.sw': {
    title: { en: 'The south-west horn', he: 'קרן מערבית דרומית' }, aka: ['horn', 'keren', 'southwest horn'], glossary: 'keren',
    purpose: { en: "Each corner of the altar had a horn, an amah square. At the south-west horn were two fine holes like two nostrils, down which the bloods poured on the western and southern yesod ran into the channel and out to the Kidron.", sources: ['Middot 3:1–2'] },
    use: { en: "The tamid's blood is given at the north-east corner and at the south-west, each throw on two sides. The wine is poured at the south-west horn while the segan stands on the horn waving the flags. A bird chatat is offered below at this corner.", sources: ['Tamid 4:1', 'Tamid 7:3', 'Zevachim 6:4'] },
    inAction: [{ event: 'tamid-blood', label: { en: 'The blood at the south-west corner' } }, { event: 'libation', label: { en: 'The wine poured at the horn' } }, { event: 'bird-offerings', label: { en: 'A bird chatat below the horn' } }],
  },
  'altar.keren.se': {
    title: { en: 'The south-east horn', he: 'קרן דרומית מזרחית' }, aka: ['horn', 'keren', 'southeast horn'], glossary: 'keren',
    purpose: { en: "Each corner of the altar had a horn, an amah square, hollow, built in with the altar.", sources: ['Middot 3:1', 'Zevachim 54b'] },
    use: { en: "The olat ha'of is offered at the south-east horn: the kohen goes up the ramp, turns to the sovev and comes to the horn. The circuit of the top begins here.", sources: ['Zevachim 6:5', 'Tamid 7:3'] },
    inAction: [{ event: 'bird-offerings', label: { en: "A bird olah at the corner" } }],
  },
  'altar.keren.nw': {
    title: { en: 'The north-west horn', he: 'קרן צפונית מערבית' }, aka: ['horn', 'keren', 'northwest horn'], glossary: 'keren',
    purpose: { en: "Each corner of the altar had a horn, an amah square. Opposite the north-western corner, at the second ring, the morning tamid was slaughtered.", sources: ['Middot 3:1', 'Tamid 4:1'] },
    use: { en: "The blood of a chatat is put on all four horns.", sources: ['Zevachim 5:3'] },
    inAction: [{ event: 'tamid-slaughter', label: { en: 'The morning tamid slaughtered opposite this corner' } }, { event: 'altar-blood', label: { en: 'Blood on the four horns' } }],
  },
  'altar.keren.ne': {
    title: { en: 'The north-east horn', he: 'קרן מזרחית צפונית' }, aka: ['horn', 'keren', 'northeast horn'], glossary: 'keren',
    purpose: { en: "Each corner of the altar had a horn, an amah square. Opposite the north-eastern corner, at the second ring, the afternoon tamid was slaughtered.", sources: ['Middot 3:1', 'Tamid 4:1'] },
    use: { en: "The receiver comes to the north-east corner and gives the blood to the east and the north, then to the south-west corner.", sources: ['Tamid 4:1'] },
    inAction: [{ event: 'tamid-blood', label: { en: 'The blood at the north-east corner' } }, { event: 'tamid-afternoon', label: { en: 'The afternoon tamid slaughtered opposite' } }],
  },
  'altar.chut-hasikra': {
    title: { en: 'Chut HaSikra (the red line)', he: 'חוט הסיקרא' }, aka: ['red line', 'sikra', 'chut hasikra'], glossary: 'chut hasikra',
    purpose: { en: "A line of red girded the altar at its middle, to divide between the upper bloods and the lower bloods.", sources: ['Middot 3:1'] },
    use: { en: "A chatat's blood and the olat ha'of above it; the olah's, the shelamim's and the others' below.", sources: ['Zevachim 5:3–5', 'Zevachim 6:4–5'] },
    inAction: [{ event: 'altar-blood', label: { en: 'Blood above and below the line' } }, { event: 'bird-offerings', label: { en: 'Birds above and below the line' } }],
  },
  'altar.shitin': {
    title: { en: 'The shitin', he: 'שיתין' }, aka: ['shitin', 'drain holes', 'nostrils'], glossary: 'shitin',
    purpose: { en: "At the south-west horn were two holes like two fine nostrils, by which the bloods poured on the western and southern yesod went down, mixed in the channel and ran out to the Kidron.", sources: ['Middot 3:2'] },
    use: { en: "The libations poured on the altar went down into the shitin.", sources: ['Sukkah 4:9', 'Zevachim 61b'] },
    inAction: [{ event: 'libation', label: { en: 'The wine runs down' } }],
  },
  'altar.shit-slab': {
    title: { en: 'The slab over the shit', he: 'טבלא של שיש' }, aka: ['marble slab', 'shit'],
    purpose: { en: "Below in the pavement at that corner was a place an amah by an amah with a marble tablet and a ring fixed in it, by which they went down to the shit and cleaned it.", sources: ['Middot 3:3'] },
  },
  'altar.libation-cups': {
    title: { en: 'The libation cups', he: 'ספלים' }, aka: ['cups', 'libation bowls', 'sefalim'], glossary: 'nesachim',
    purpose: { en: "Two cups at the south-west horn — of silver; R' Yehudah: of plaster, blackened by the wine — pierced like two fine nostrils, one wider for the wine and one narrower for the water, so that both drain at once.", sources: ['Sukkah 4:9', 'Sukkah 48b'] },
    inAction: [{ event: 'libation', label: { en: 'The wine poured' } }, { event: 'afternoon-song', label: { en: 'The afternoon libation' } }],
    aliases: ['altar.libation-cup.water', 'altar.libation-cup.wine'],
  },
  'altar.kevesh': {
    title: { en: 'The kevesh (altar ramp)', he: 'כבש המזבח' }, aka: ['kevesh', 'ramp', 'altar ramp', 'כבש'], glossary: 'kevesh',
    purpose: { en: "A ramp was at the south of the altar, thirty-two amot long and sixteen wide, with a window (revuvah) in its west where the bird chatat offerings that became unfit were put. Its stones, like the altar's, were whole, untouched by iron.", sources: ['Middot 3:3–4'] },
    use: { en: "One goes up on the east of the ramp, round the top to the right and down on the west. The tamid's limbs are laid on the lower half of the ramp on its west side and salted there.", sources: ['Zevachim 6:3', 'Tamid 4:3', 'Tamid 7:3'] },
    inAction: [{ event: 'limbs-to-ramp', label: { en: 'The limbs laid and salted' } }, { event: 'limbs-up', label: { en: 'Carried up the ramp' } }, { event: 'terumat-hadeshen', label: { en: 'Up the east, down the west' } }],
  },
  'altar.kevesh.ramp-sovev': {
    title: { en: 'The small ramp to the sovev', he: 'כבש קטן לסובב' }, aka: ['small ramp'],
    purpose: { en: "Two small ramps came off the kevesh, by which they turned to the sovev and to the yesod, a hair's breadth from the altar.", sources: ['Zevachim 62b', 'Rambam BhB 2:14'] },
    use: { en: "The olat ha'of: he goes up the ramp, turns to the sovev and comes to the south-east horn.", sources: ['Zevachim 6:5'] },
    inAction: [{ event: 'bird-offerings', label: { en: 'Turning to the sovev with a bird' } }],
  },
  'altar.kevesh.ramp-yesod': {
    title: { en: 'The small ramp to the yesod', he: 'כבש קטן ליסוד' }, aka: ['small ramp'],
    purpose: { en: "Two small ramps came off the kevesh, by which they turned to the sovev and to the yesod, a hair's breadth from the altar.", sources: ['Zevachim 62b', 'Rambam BhB 2:14'] },
  },
  'altar.kevesh.revuvah': {
    title: { en: 'The revuvah', he: 'רבובה' }, aka: ['revuvah', 'window'], glossary: 'revuvah',
    purpose: { en: "The kevesh had a window (revuvah) on its west side, where they put the bird chatat offerings that had become unfit, until their form decayed.", sources: ['Middot 3:3', 'Rambam BhB 2:14'] },
  },
  'altar.machtah-niche': {
    title: { en: 'The place of the silver pan', he: 'מקום המחתה' }, aka: ['machtah', 'coal pan'], glossary: 'machtah',
    purpose: { en: "The silver pan was kept in the corner between the ramp and the altar, on the west of the ramp.", sources: ['Tamid 1:4'] },
    use: { en: "The one who won the clearing of the ashes sanctifies his hands and feet from the kiyor, takes the silver pan and goes up.", sources: ['Tamid 1:4'] },
    inAction: [{ event: 'terumat-hadeshen', label: { en: 'The silver pan taken up' } }], aliases: ['altar.machtah'],
  },
  'altar.table.marble': {
    title: { en: 'The marble table west of the ramp', he: 'שלחן של שיש' }, aka: ['marble table', 'table of the fats'],
    purpose: { en: "Two tables stood west of the ramp, one of marble and one of silver: on the marble they put the limbs.", sources: ['Shekalim 6:4'] },
    use: { en: "At the libation two kohanim stand on the table of the fats with two silver trumpets in their hands and blow teki'ah, teru'ah, teki'ah.", sources: ['Tamid 7:3'] },
    inAction: [{ event: 'libation', label: { en: 'The trumpeters on the table' } }],
  },
  'altar.table.silver': {
    title: { en: 'The silver table west of the ramp', he: 'שלחן של כסף' }, aka: ['silver table', 'table of vessels'],
    purpose: { en: "Two tables stood west of the ramp, one of marble and one of silver: on the silver they put the service vessels.", sources: ['Shekalim 6:4'] },
    inAction: [{ event: 'vessels', label: { en: 'The vessels set out' } }],
  },
  'altar.beit-hadeshen': {
    title: { en: 'Beit HaDeshen', he: 'בית הדשן' }, aka: ['ash place', 'beit hadeshen', 'ashes'], glossary: 'beit hadeshen',
    purpose: { en: "On reaching the pavement the one who took up the ashes turned north, walked about ten amot along the east of the ramp and heaped the coals on the pavement three tefachim from the ramp — the place where the crops of the birds and the ashes of the inner altar and of the Menorah are put.", sources: ['Tamid 1:4'] },
    inAction: [{ event: 'terumat-hadeshen', label: { en: 'The coals heaped by the ramp' } }, { event: 'inner-clearing', label: { en: 'The inner ashes brought out' } }, { event: 'bird-offerings', label: { en: 'The crop thrown to the ash place' } }],
  },
  'altar.rings': {
    title: { en: 'The rings', he: 'טבעות' }, aka: ['rings', 'tabaot', 'slaughter rings', 'טבעות'], glossary: "taba'ot",
    purpose: { en: "Rings were north of the altar, six rows of four — some say four of six — on which they slaughtered the offerings.", sources: ['Middot 3:5', 'Middot 5:2'] },
    use: { en: "The morning tamid was slaughtered at the north-west corner on the second ring, the afternoon's at the north-east on the second ring. They did not tie the lamb but bound it, its head south and its face west, the slaughterer east of it facing west.", sources: ['Tamid 4:1'] },
    notes: { en: "Bilgah's ring was fixed in place as a penalty.", sources: ['Sukkah 5:8'] },
    inAction: [{ event: 'tamid-slaughter', label: { en: 'The morning tamid slaughtered' } }, { event: 'tamid-afternoon', label: { en: 'The afternoon tamid slaughtered' } }, { event: 'private-offerings', label: { en: 'Individuals lean and slaughter' } }],
  },
  'altar.marble-tables': {
    title: { en: 'The marble tables', he: 'שלחנות של שיש' }, aka: ['marble tables', 'eight tables', 'flaying tables'],
    purpose: { en: "Eight tables of marble stood in the slaughterhouse, on which they rinsed the innards; they flayed on the marble tables between the pillars.", sources: ['Shekalim 6:4', 'Middot 3:5', 'Tamid 3:5'] },
    use: { en: "The innards of the tamid are rinsed at least three times on the marble tables between the pillars.", sources: ['Tamid 4:2'] },
    inAction: [{ event: 'flaying', label: { en: 'The innards rinsed' } }, { event: 'private-flaying', label: { en: 'Flaying and rinsing' } }],
  },
  'altar.nanasin': {
    title: { en: 'The dwarf pillars (nanasin)', he: 'עמודים ננסין' }, aka: ['nanasin', 'dwarf pillars', 'hooks', 'pillars', 'slaughterhouse'], glossary: 'nanasin',
    purpose: { en: "The slaughterhouse was north of the altar, and in it eight dwarf pillars with squares of cedar on top; iron hooks were fixed in them, three rows on each, on which they hung the carcasses.", sources: ['Middot 3:5', 'Tamid 3:5'] },
    use: { en: "He did not break the leg but pierced it at the knee and hung it; he flayed down to the chest, then cut the parts in order, giving each to the one who won it.", sources: ['Tamid 4:2'] },
    inAction: [{ event: 'flaying', label: { en: 'The tamid hung and flayed' } }, { event: 'afternoon-flaying', label: { en: 'The afternoon lamb flayed' } }, { event: 'private-flaying', label: { en: 'Offerings hung and flayed' } }],
  },
  'altar.kiyor': {
    title: { en: 'The kiyor (laver)', he: 'כיור' }, aka: ['kiyor', 'laver', 'basin', 'כיור'], glossary: 'kiyor',
    purpose: { en: "The kiyor stood between the Ulam and the altar, drawn toward the south. From it the kohanim sanctify their hands and feet before the service.", sources: ['Middot 3:6', 'Shemot 30:18–21', 'Tamid 1:4'] },
    use: { en: "Ben Katin made twelve spigots for it, where there had been two, and made a machine (muchni) for it, so that its water would not become unfit by staying overnight.", sources: ['Yoma 3:10', 'Yoma 37a', 'Tamid 3:8'] },
    notes: { en: "Its form beyond this is not given; the bronze and its shape are the model's.", sources: ['Shemot 30:18'] },
    inAction: [{ event: 'muchni', label: { en: 'The kiyor rises from its well' } }, { event: 'terumat-hadeshen', label: { en: 'Hands and feet sanctified' } }, { event: 'clearing-altar', label: { en: 'The brothers sanctify and run up' } }],
    aliases: ['altar.kiyor'],
  },
  'altar.kiyor.muchni': {
    title: { en: 'The muchni', he: 'מוכני' }, aka: ['muchni', 'wheel', 'machine', 'ben katin'], glossary: 'muchni',
    purpose: { en: "Ben Katin made a machine for the kiyor so that its water would not become unfit by being left overnight: it sank the kiyor in water at night.", sources: ['Yoma 3:10', 'Yoma 37a', 'Tamid 1:4'] },
    use: { en: "No one went in with the winner of the ashes, and no lamp; his brothers did not see him or hear him until they heard the sound of the wood Ben Katin made for the kiyor — and said, 'The time has come'. Its sound was heard as far as Yericho.", sources: ['Tamid 1:4', 'Tamid 3:8'] },
    inAction: [{ event: 'muchni', label: { en: 'The wheel creaks: "the time has come"' } }],
    aliases: ['wheel:altar.kiyor.muchni'],
  },
  'altar.ulam-steps': {
    title: { en: 'The steps of the Ulam', he: 'מעלות האולם' }, aka: ['ulam steps', 'porch steps', 'twelve steps'],
    purpose: { en: "Between the Ulam and the altar were twenty-two amot, and twelve steps were there, each half an amah high and an amah deep: amah, amah and a landing of three; amah, amah and a landing of three; and at the top amah, amah and a landing of four (R' Yehudah: five).", sources: ['Middot 3:6'] },
    use: { en: "After the incense the kohanim came and stood on the steps of the Ulam and blessed the people with one blessing, saying the Name as it is written, their hands above their heads — but the Kohen Gadol not above the tzitz.", sources: ['Tamid 7:2'] },
    inAction: [{ event: 'birkat-kohanim', label: { en: 'Birkat Kohanim from the steps' } }],
  },

  // ======================================================================== the Ulam and the Heichal
  'heichal.otem': {
    title: { en: 'The otem', he: 'אטם' }, aka: ['otem', 'podium', 'foundation'], glossary: 'otem',
    purpose: { en: "The Heichal was a hundred by a hundred, a hundred high: the otem six amot, then the house forty.", sources: ['Middot 4:6'] },
    notes: { en: "Whether the otem was a sealed foundation below ground or a solid storey above it is disputed; the model raises it above the court, the twelve steps of the Ulam climbing it.", sources: ['Middot 4:6', 'Rambam BhB 4:3'] },
  },
  'heichal.ulam.opening': {
    title: { en: 'The entrance of the Ulam', he: 'פתחו של אולם' }, aka: ['ulam', 'porch', 'ulam entrance', 'אולם'], glossary: 'ulam',
    purpose: { en: "The entrance of the Ulam was forty amot high and twenty wide — the one gateway in the Mikdash that was not twenty by ten, and the only one without doors.", sources: ['Middot 3:7', 'Middot 2:3'] },
    use: { en: "A curtain hung in it, one of the thirteen. During the incense in the Heichal all withdrew from between the Ulam and the altar.", sources: ['Yoma 54a', 'Tamid 6:3', 'Yoma 44a'] },
    inAction: [{ event: 'into-heichal', label: { en: 'Into the Heichal' } }, { event: 'ketoret-morning', label: { en: 'All withdraw during the incense' } }],
  },
  'heichal.ulam.lintels': {
    title: { en: 'The five lintels of milah wood', he: 'חמש מלתראות של מילת' }, aka: ['lintels', 'milah', 'beams'], glossary: 'milah',
    purpose: { en: "Five lintels of milah wood were over the entrance of the Ulam: the lowest projecting an amah beyond the opening on each side, the one above it an amah beyond it, so that the uppermost was thirty amot, with a course of stones between each.", sources: ['Middot 3:7'] },
  },
  'heichal.ulam.vine': {
    title: { en: 'The golden vine', he: 'גפן של זהב' }, aka: ['golden vine', 'vine', 'gefen'], glossary: 'gefen shel zahav',
    purpose: { en: "A vine of gold stood over the entrance of the Heichal, trained on posts. Whoever vowed a leaf, a grape or a cluster brought it and hung it on it. R' Eliezer son of R' Tzadok: it once happened that three hundred kohanim were counted for it.", sources: ['Middot 3:8'] },
  },
  'heichal.ulam.chains': {
    title: { en: 'The gold chains', he: 'שרשרות של זהב' }, aka: ['chains', 'sharsherot', 'crowns', 'atarot'], glossary: 'sharsherot',
    purpose: { en: "Chains of gold were fixed in the ceiling of the Ulam, by which the young kohanim climbed and saw the crowns — 'and the crowns shall be to Chelem and to Toviyah and to Yedayah and to Chen the son of Tzefanyah, a memorial in the Temple of the Lord'.", sources: ['Middot 3:8', 'Zechariah 6:14'] },
    notes: { en: "Where the crowns were is not stated; Bartenura: in the windows of the Heichal — where the model sets them.", sources: ['Middot 3:8'] },
  },
  'heichal.ulam.nivreshet': {
    title: { en: "Queen Helena's nivreshet", he: 'נברשת של זהב' }, aka: ['nivreshet', 'chandelier', 'helena', 'golden lamp'], glossary: 'nivreshet',
    purpose: { en: "Helena the queen made a nivreshet of gold over the entrance of the Heichal. When the sun rose, sparks shone from it, and all knew it was the time to read the Shema.", sources: ['Yoma 3:10', 'Yoma 37b'] },
    inAction: [{ event: 'nivreshet', label: { en: 'It flashes at sunrise' } }], aliases: ['heichal.nivreshet'],
  },
  'heichal.ulam.tables': {
    title: { en: 'The two tables in the Ulam', he: 'שני שלחנות באולם' }, aka: ['showbread tables', 'marble table', 'gold table'],
    purpose: { en: "In the Ulam, inside, at the entrance of the House, were two tables, one of marble and one of gold: on the marble they put the showbread on its way in, and on the gold on its way out, for one raises in holiness and does not lower.", sources: ['Shekalim 6:4', 'Menachot 11:7'] },
    inAction: [{ event: 'showbread-swap', label: { en: 'The bread changed' } }, { event: 'bread-warm', label: { en: 'The old bread still warm' } }],
  },
  'heichal.ulam-curtain': {
    title: { en: 'The curtain of the Ulam', he: 'פרוכת האולם' }, aka: ['curtain', 'parochet'], glossary: 'parochet',
    purpose: { en: "Thirteen curtains were in the Second Temple: seven on the seven gates, one on the entrance of the Ulam, one on the entrance of the Heichal, two at the Devir and two above them in the upper storey.", sources: ['Yoma 54a'] },
    aliases: ['curtain:heichal.ulam-curtain'], confidence: 'reconstruction',
  },
  'heichal.gate-curtain': {
    title: { en: 'The curtain of the Heichal gate', he: 'פרוכת שער ההיכל' }, aka: ['curtain', 'parochet'], glossary: 'parochet',
    purpose: { en: "One of the thirteen curtains of the Second Temple hung at the entrance of the Heichal.", sources: ['Yoma 54a'] },
    use: { en: "When the Kohen Gadol went in to prostrate, the officer heard his footsteps as he came out and raised the curtain for him.", sources: ['Tamid 7:1'] },
    inAction: [{ event: 'great-gate', label: { en: 'The gate opened behind it' } }], aliases: ['curtain:heichal.gate-curtain'], confidence: 'reconstruction',
  },
  'heichal.gate.great': {
    title: { en: 'The great gate of the Heichal', he: 'השער הגדול' }, aka: ['great gate', 'heichal gate', 'doors of the heichal'], glossary: 'heichal',
    purpose: { en: "The entrance of the Heichal was twenty amot high and ten wide, with four doors, two within and two without: the outer opened into the doorway to cover the thickness of the wall, the inner into the house to cover behind the doors — for the whole house was plated with gold except behind the doors.", sources: ['Middot 4:1'] },
    use: { en: "Each morning the officer opened the north wicket, went through the cell into the Heichal and came to the great gate, drew back the bolt and the locks and opened it. The slaughterer did not slaughter until he heard the sound of the great gate opening — heard as far as Yericho.", sources: ['Tamid 3:7–8'] },
    inAction: [{ event: 'great-gate', label: { en: 'The great gate opens' } }, { event: 'dishun-men', label: { en: 'The men of the dishun go ahead' } }],
    aliases: ['door:heichal.gate.great'],
  },
  'heichal.gate.wicket-n': {
    title: { en: 'The north wicket of the great gate', he: 'פשפש צפוני' }, aka: ['north wicket', 'pishpash'], glossary: 'pishpash',
    purpose: { en: "The great gate had two wickets, one in the north and one in the south. By the north one the officer went in each morning — he opened it, went into the cell and from the cell into the Heichal.", sources: ['Middot 4:2', 'Tamid 3:7'] },
    notes: { en: "R' Yehudah: he walked within the thickness of the wall until he stood between the two gates.", sources: ['Middot 4:2'] },
    inAction: [{ event: 'dishun-men', label: { en: 'The wicket opened' } }], aliases: ['door:heichal.gate.wicket-n'],
  },
  'heichal.gate.wicket-s': {
    title: { en: 'The south wicket of the great gate', he: 'פשפש דרומי' }, aka: ['south wicket'], glossary: 'pishpash',
    purpose: { en: "No man ever went in by the south wicket; of it Yechezkel said: 'This gate shall be shut, it shall not be opened, and no man shall come in by it, for the Lord the God of Israel has come in by it.'", sources: ['Middot 4:2', 'Tamid 3:7', 'Yechezkel 44:2'] },
    aliases: ['door:heichal.gate.wicket-s'],
  },
  'heichal.ta.door-ne': {
    title: { en: 'The door from the north-east cell', he: 'פתח מן התא להיכל' }, aka: ['ta', 'cell door'],
    purpose: { en: "Every cell had three doors; the cell at the north-east corner had five — to the cell on its right, to the cell above, to the winding stair, to the wicket and to the Heichal.", sources: ['Middot 4:3'] },
    inAction: [{ event: 'dishun-men', label: { en: 'Through the cell into the Heichal' } }], aliases: ['door:heichal.ta.door-ne'],
  },
  'heichal.taim.north': {
    title: { en: "The ta'im — north", he: 'תאים — צפון' }, aka: ['taim', "ta'im", 'cells', 'side chambers'], glossary: 'ta',
    purpose: { en: "Thirty-eight cells were round the Heichal: fifteen on the north, five over five and five over them; fifteen on the south; and eight on the west, three over three and two over them. Each had three doors — to the cell on its right, on its left, and above it.", sources: ['Middot 4:3'] },
    notes: { en: "The lowest storey was five amot wide, the middle six, the top seven, each resting on a ledge of the wall below.", sources: ['Middot 4:4'] },
    aliases: ['door:heichal.ta-wall.north'],
  },
  'heichal.taim.south': {
    title: { en: "The ta'im — south", he: 'תאים — דרום' }, aka: ['taim', "ta'im", 'cells'], glossary: 'ta',
    purpose: { en: "Thirty-eight cells were round the Heichal: fifteen on the north, fifteen on the south — five over five and five over them — and eight on the west.", sources: ['Middot 4:3'] },
    notes: { en: "South of them, a passage three amot wide — the house of the descent of the water.", sources: ['Middot 4:7'] },
  },
  'heichal.taim.west': {
    title: { en: "The ta'im — west", he: 'תאים — מערב' }, aka: ['taim', "ta'im", 'cells'], glossary: 'ta',
    purpose: { en: "On the west of the Heichal were eight cells: three over three and two over them.", sources: ['Middot 4:3'] },
  },
  'heichal.taim.roofs': {
    title: { en: "The roofs of the ta'im", he: 'גגות התאים' }, aka: ['roofs'],
    purpose: { en: "By the winding stair they went up to the roofs of the cells, round the north, the west and the south to the door of the upper storey.", sources: ['Middot 4:5'] },
  },
  'heichal.mesibah': {
    title: { en: 'The mesibah', he: 'מסיבה' }, aka: ['mesibah', 'winding stair', 'winding ascent'], glossary: 'mesibah',
    purpose: { en: "A winding way went up from the north-east corner to the north-west, by which they went up to the roofs of the cells: up it facing west, along the whole north to the west, turning south along the west, then east along the south to the door of the upper storey, which opened to the south.", sources: ['Middot 4:5'] },
  },
  'heichal.taim.roof-stair': {
    title: { en: 'Steps to the door of the upper storey', he: 'מעלות לפתח העליה' }, aka: ['aliyah stair'],
    purpose: { en: "Along the south one came to the door of the upper storey; at it were two cedar posts by which they climbed to its roof.", sources: ['Middot 4:5'] },
    confidence: 'reconstruction',
  },
  'heichal.aliyah.door': {
    title: { en: 'The door of the upper storey', he: 'פתחה של עליה' }, aka: ['aliyah', 'upper storey'], glossary: 'aliyah',
    purpose: { en: "The door of the upper storey opened to the south; in it rashei pispasin divided between the holy and the most holy, and hatches (lulin) opened into the Kodesh HaKodashim, by which craftsmen were let down in boxes so that their eyes would not feast on it.", sources: ['Middot 4:5'] },
    notes: { en: "It was entered once in seven years to see what needed repair.", sources: ['Rambam BhB 7:23'] },
    aliases: ['door:heichal.aliyah.door'],
  },
  'heichal.windows.f1': {
    title: { en: 'The windows of the Heichal', he: 'חלונות שקופים אטומים' }, aka: ['windows', 'shekufim atumim'],
    purpose: { en: "'Windows broad and narrow' — narrow within and wide without, for the House did not need their light: it gave light to the world.", sources: ['I Melachim 6:4', 'Menachot 86b'] },
    notes: { en: "Their number and places in the Second Temple are not given; the model's.", sources: ['Menachot 86b'] }, confidence: 'reconstruction',
  },
  'heichal.windows.f2': {
    title: { en: 'The windows of the crowns', he: 'חלונות העטרות' }, aka: ['crowns', 'atarot', 'crown windows'], glossary: 'atarot',
    purpose: { en: "The young kohanim climbed the gold chains of the Ulam to see the crowns, the memorial of Zechariah — set, Bartenura says, in windows of the Heichal.", sources: ['Middot 3:8', 'Zechariah 6:14'] },
    confidence: 'reconstruction',
  },
  'heichal.chalifot.n.wicket': {
    title: { en: 'Wicket of Beit HaChalifot (north)', he: 'פשפש בבית החליפות' }, aka: ['beit hachalifot', 'chalifot', 'knives'], glossary: 'beit hachalifot',
    purpose: { en: "The Ulam projected fifteen amot beyond the Heichal on the north and fifteen on the south; this was called Beit HaChalifot, where they stored the knives.", sources: ['Middot 4:7'] },
    notes: { en: "R' Yosi son of R' Yehudah: two wickets eight amot high stood in Beit HaChalifot, to make the whole court fit for eating the most-holy offerings and slaughtering the lesser ones.", sources: ['Zevachim 55b'] },
    aliases: ['door:heichal.chalifot.n.wicket'],
  },
  'heichal.chalifot.s.wicket': {
    title: { en: 'Wicket of Beit HaChalifot (south)', he: 'פשפש בבית החליפות' }, aka: ['beit hachalifot', 'chalifot', 'bilgah'], glossary: 'beit hachalifot',
    purpose: { en: "The Ulam projected fifteen amot beyond the Heichal on the north and fifteen on the south; this was called Beit HaChalifot, where they stored the knives.", sources: ['Middot 4:7'] },
    notes: { en: "Each watch had a niche for its knives; Bilgah's window was sealed as a penalty.", sources: ['Sukkah 5:8', 'Sukkah 56b'] },
    aliases: ['door:heichal.chalifot.s.wicket'],
  },
  'heichal.lul-west': {
    title: { en: 'The lul behind the Kaporet', he: 'לול קטן אחורי בית הכפורת' }, aka: ['lul', 'behind the kaporet'],
    purpose: { en: "Behind the Beit HaKaporet was a small opening (lul), eight amot high, to make the strip behind it part of the court.", sources: ['Zevachim 55b'] },
    use: { en: "A Levite kept watch behind the Beit HaKaporet through the night.", sources: ['Middot 1:1'] },
    inAction: WATCH, confidence: 'reconstruction',
  },
  'heichal.sotah-slab': {
    title: { en: 'The slab of the sotah dust', he: 'טבלא של שיש — עפר סוטה' }, aka: ['sotah', 'marble tablet'],
    purpose: { en: "He went into the Heichal and turned to his right; there was a place an amah by an amah with a marble tablet and a ring fixed in it. He lifted it, took dust from beneath it and put it in the water for the sotah.", sources: ['Sotah 2:2'] },
    notes: { en: "Shiltei HaGiborim: 'to his right — that is, the north of the Heichal'.", sources: ['Sotah 2:2'] }, confidence: 'reconstruction',
  },
  'heichal.menorah': {
    title: { en: 'The Menorah', he: 'מנורה' }, aka: ['menorah', 'lampstand', 'candelabrum', 'ner maaravi', 'western lamp', 'מנורה'], glossary: 'menorah', zone: 'heichal',
    purpose: { en: "The Menorah of pure gold, beaten out of one talent, eighteen tefachim high, its lamps lit each evening; it stood in the south of the Heichal, opposite the Shulchan.", sources: ['Shemot 25:31–39', 'Menachot 28b', 'Rambam BhB 3:1–11', 'Shemot 30:8'] },
    use: { en: "In the morning the one who won the Menorah's ashes found the two eastern lamps burning; he cleaned the others and left these, and later cleaned the eastern and left the western burning, from which he lit the Menorah in the evening. Before it was a stone with three steps on which he stood to dress the lamps, setting the kuz on the second step.", sources: ['Tamid 3:9', 'Tamid 6:1'] },
    notes: { en: "Whether its lamps ran east–west (Raavad, as Tamid's 'two eastern lamps') or north–south (Rambam) is disputed; the model runs them east–west.", sources: ['Tamid 3:9', 'Rambam BhB 3:12'] },
    inAction: [{ event: 'inner-clearing', label: { en: 'Five lamps dressed' } }, { event: 'into-heichal', label: { en: 'The last two lamps' } }, { event: 'menorah-lighting', label: { en: 'The Menorah lit' } }],
    aliases: ['heichal.menorah.lamp-0', 'heichal.menorah.lamp-1', 'heichal.menorah.lamp-2', 'heichal.menorah.lamp-3', 'heichal.menorah.lamp-4', 'heichal.menorah.lamp-5', 'heichal.menorah.lamp-6'],
  },
  'heichal.shulchan': {
    title: { en: 'The Shulchan', he: 'שלחן' }, aka: ['shulchan', 'table', 'golden table', 'showbread', 'lechem hapanim', 'שלחן'], glossary: 'shulchan', zone: 'heichal',
    purpose: { en: "The golden table in the north of the Heichal, on which the showbread lay always — twelve loaves in two stacks of six, with the two dishes of frankincense.", sources: ['Shemot 25:23–30', 'Vayikra 24:5–9', 'Shekalim 6:4', 'Yoma 33b'] },
    use: { en: "Every Shabbat four kohanim came in with the new stacks and dishes and four took the old: these drew out as those put on, 'the handbreadth of one beside the handbreadth of the other', for it is written 'before Me always'.", sources: ['Menachot 11:7'] },
    notes: { en: "The loaves rested on gold rods between gold supports so the bread would not mould; the table's length and the loaves' shape are disputed in Menachot.", sources: ['Menachot 11:5–6', 'Menachot 96a'] },
    inAction: [{ event: 'showbread-swap', label: { en: 'The showbread changed' } }],
    aliases: ['heichal.shulchan.bread', 'heichal.shulchan.bread.incoming'],
  },
  'heichal.mizbach-hazahav': {
    title: { en: 'The golden altar', he: 'מזבח הזהב' }, aka: ['golden altar', 'incense altar', 'inner altar', 'mizbach hazahav'], glossary: 'mizbach hazahav', zone: 'heichal',
    purpose: { en: "The altar of incense, an amah by an amah and two high, plated with gold, set in the middle of the Heichal, drawn toward the entrance; on it the incense was burned morning and evening.", sources: ['Shemot 30:1–8', 'Yoma 33b'] },
    use: { en: "In the morning the one who won its clearing took the ashes into the teni; at the incense the coals are heaped on it and spread, the incense is poured on, and all withdraw: none may be between the Ulam and the altar while it is burned.", sources: ['Tamid 3:9', 'Tamid 6:2–3', 'Yoma 44a'] },
    inAction: [{ event: 'inner-clearing', label: { en: 'The inner altar cleared' } }, { event: 'ketoret-morning', label: { en: 'The morning incense' } }, { event: 'ketoret-afternoon', label: { en: 'The afternoon incense' } }],
  },
  'heichal.parochet.outer': {
    title: { en: 'The outer parochet', he: 'פרוכת חיצונה' }, aka: ['parochet', 'curtain', 'veil', 'פרוכת'], glossary: 'parochet',
    purpose: { en: "Where the First Temple had a wall an amah thick between the Kodesh and the Kodesh HaKodashim, the Second had two curtains an amah apart, for they did not know whether that amah was within or without. The outer was looped back at its south end, the inner at its north.", sources: ['Yoma 5:1', 'Yoma 51b–52b', 'Rambam BhB 4:2'] },
    use: { en: "On Yom Kippur the Kohen Gadol walked between them until he reached the north, and turned his face south. Each curtain was a tefach thick, woven on seventy-two cords of twenty-four threads; two were made each year.", sources: ['Yoma 5:1', 'Shekalim 8:5'] },
    notes: { en: "R' Yosi: there was only one curtain.", sources: ['Yoma 51b'] },
    aliases: ['curtain:heichal.parochet.outer'],
  },
  'heichal.parochet.inner': {
    title: { en: 'The inner parochet', he: 'פרוכת פנימית' }, aka: ['parochet', 'curtain', 'veil'], glossary: 'parochet',
    purpose: { en: "The second of the two curtains between the Kodesh and the Kodesh HaKodashim, an amah behind the first, looped back at its north end.", sources: ['Yoma 5:1', 'Yoma 51b–52b'] },
    aliases: ['curtain:heichal.parochet.inner'],
  },
  'heichal.even-shetiyah': {
    title: { en: 'Even Shetiyah', he: 'אבן שתיה' }, aka: ['foundation stone', 'even shetiyah', 'שתיה'], glossary: 'even shetiyah',
    purpose: { en: "After the Ark was taken away a stone was there from the days of the early prophets, called Shetiyah, three fingerbreadths above the ground; on it the Kohen Gadol set the coal pan on Yom Kippur.", sources: ['Yoma 5:2', 'Yoma 53b'] },
    notes: { en: "In the Second Temple the Kodesh HaKodashim held nothing else: the Ark was among the five things it lacked.", sources: ['Yoma 21b', 'Rambam BhB 4:1'] },
    zone: 'kodesh-hakodashim',
  },
  'heichal.kalya-orev': {
    title: { en: 'Kalya orev', he: 'כלה עורב' }, aka: ['kalya orev', 'raven destroyer', 'spikes', 'parapet'], glossary: 'kalya orev', zone: 'roof',
    purpose: { en: "At the very top of the Heichal's hundred amot: a parapet three amot and the kalya orev, an amah — R' Yehudah: it was not counted in the measure, and the parapet was four.", sources: ['Middot 4:6'] },
    notes: { en: "It was of iron: the Rambam, 'a blade of iron like a sword, an amah high, on the parapet all round'; Rashi, plates of iron with nails standing out; an iron gift was 'a kalya orev plate, an amah by an amah'.", sources: ['Rambam BhB 4:3', 'Menachot 107a', 'Shabbat 90a'] },
  },
  'heichal.ceiling.kiyur': { title: { en: 'The kiyur course', he: 'כיור' }, purpose: CEILING, notes: { en: "What the kiyur and the beit dilpah were is disputed; the model draws a decorated course and a void for drips.", sources: ['Middot 4:6'] } },
  'heichal.ceiling.dilpah': { title: { en: 'The beit dilpah', he: 'בית דילפא' }, purpose: CEILING },
  'heichal.ceiling.tikrah': { title: { en: 'The tikrah (ceiling)', he: 'תקרה' }, purpose: CEILING },
  'heichal.ceiling.maazivah': { title: { en: "The ma'azivah", he: 'מעזיבה' }, purpose: CEILING },
  'heichal.roof.kiyur': { title: { en: 'The kiyur course (roof)', he: 'כיור' }, purpose: CEILING },
  'heichal.roof.dilpah': { title: { en: 'The beit dilpah (roof)', he: 'בית דילפא' }, purpose: CEILING },
  'heichal.roof.tikrah': { title: { en: 'The tikrah (roof)', he: 'תקרה' }, purpose: CEILING },
  'heichal.roof.maazivah': { title: { en: "The ma'azivah (roof)", he: 'מעזיבה' }, purpose: CEILING },
  'heichal.roof': { title: { en: 'The roof of the Heichal', he: 'גג ההיכל' }, purpose: CEILING, notes: { en: "Round it, the parapet and the kalya orev of iron, so that birds could not settle.", sources: ['Middot 4:6', 'Rambam BhB 4:3'] } },

  // ======================================================================== water
  'azarah.amah-channel': {
    title: { en: 'The amah (the water channel)', he: 'האמה' }, aka: ['amah', 'channel', 'water channel', 'drain'], glossary: 'amah',
    purpose: { en: "The bloods given on the western and southern yesod went down the holes at the south-west horn, mixed in the channel and ran out to the Nachal Kidron.", sources: ['Middot 3:2'] },
    use: { en: "About a kav of coals spilled when the coals for the incense were poured from silver into gold; he swept them into the channel.", sources: ['Tamid 5:5'] },
    notes: { en: "The blood running out was sold to gardeners for fertiliser; on a Pesach that fell on Shabbat they rinsed the court with it.", sources: ['Yoma 58b', 'Pesachim 5:8'] },
    inAction: [{ event: 'coal-pan', label: { en: 'The spilled coals swept into it' } }],
  },

  // ======================================================================== the altar's and hearths' fires
  'fire:altar.maarachah.great': {
    title: { en: 'The great pile (ma\'arachah gedolah)', he: 'מערכה גדולה' }, aka: ['great pile', 'altar fire', 'fire'], glossary: "ma'arachah gedolah", zone: 'mizbeach',
    purpose: { en: "The great pile was built on the east of the altar, its face to the east, the inner ends of its logs touching the tapuach; on it the limbs and fats are burned. A fire burns on the altar always; it shall not go out.", sources: ['Tamid 2:4', 'Vayikra 6:6'] },
    notes: { en: "In the Second Temple the fire that came down from heaven did not help; the fire is an ordinary fire that must be fed. Of the miracles: the rain never put it out, and the wind never bent its column of smoke.", sources: ['Yoma 21b', 'Avot 5:5'] },
    inAction: [{ event: 'great-pile', label: { en: 'The great pile built' } }, { event: 'limbs-up', label: { en: 'The limbs thrown on it' } }, { event: 'fats-burning', label: { en: 'Burning through the night' } }],
  },
  'fire:altar.maarachah.great.inner': {
    title: { en: 'The great pile', he: 'מערכה גדולה' }, aka: ['great pile'], glossary: "ma'arachah gedolah", zone: 'mizbeach',
    purpose: { en: "The great pile on the east of the altar, the inner ends of its logs touching the tapuach; on it the limbs and fats are burned.", sources: ['Tamid 2:4'] },
  },
  'fire:altar.maarachah.incense': {
    title: { en: 'The second pile, for the incense', he: 'מערכה שניה של קטרת' }, aka: ['second pile', 'incense pile'], glossary: "ma'arachah sheniyah", zone: 'mizbeach',
    purpose: { en: "Fine fig wood was chosen for the second pile, for the incense, opposite the south-west horn, four amot from it toward the north, of five se'ah of coals — on Shabbat eight, for there the two dishes of frankincense of the showbread are put.", sources: ['Tamid 2:5'] },
    use: { en: "From it the coals for the incense are taken in the silver pan.", sources: ['Tamid 5:5'] },
    inAction: [{ event: 'second-pile', label: { en: 'The second pile built and lit' } }, { event: 'coal-pan', label: { en: 'Coals taken for the incense' } }, { event: 'bazichin', label: { en: "Shabbat: the frankincense burned" } }],
  },
  'fire:altar.maarachah.kiyum': {
    title: { en: 'The pile that keeps the fire', he: 'מערכה לקיום האש' }, aka: ['third pile', 'kiyum haesh'], glossary: "kiyum ha'esh", zone: 'mizbeach',
    purpose: { en: "R' Yosi: three piles were on the altar each day — the great pile, the second for the incense, and a third to keep the fire alive.", sources: ['Yoma 4:6', 'Yoma 45a'] },
    notes: { en: "R' Meir counts four, R' Yehudah two; the model shows R' Yosi's three.", sources: ['Yoma 4:6'] },
  },
  'fire:courts.moked.hearth': {
    title: { en: 'The fire of Beit HaMoked', he: 'מוקד' }, aka: ['hearth', 'moked fire'], glossary: 'beit hamoked', zone: 'beit-hamoked',
    purpose: null,
    notes: { en: "Beit HaMoked — 'the house of the hearth' — is named for its fire; the Mishnah does not describe it. The kohanim walked barefoot on the stone all year.", sources: ['Middot 1:8', 'Tamid 1:1'] },
    confidence: 'reconstruction',
  },
  'fire:courts.beit-hatevilah.medurah': {
    title: { en: 'The fire of the Beit HaTevilah', he: 'מדורה' }, aka: ['medurah', 'fire'], glossary: 'medurah', zone: 'beit-hatevilah',
    purpose: { en: "A fire was kept in the immersion house; after immersing he came up, dried himself and warmed himself before it.", sources: ['Tamid 1:1'] },
    inAction: [{ event: 'mesibah-keri', label: { en: 'Warming at the fire' } }, { event: 'dawn-immersion', label: { en: 'Warming after the immersion' } }],
  },
  'fire:courts.chavitin.hearth': {
    title: { en: 'The chavitin griddle', he: 'מחבת החביתין' }, aka: ['griddle', 'chavitin'], glossary: 'chavitin', zone: 'lishkat-chavitin',
    purpose: { en: "The Kohen Gadol's chavitin are made on a griddle with oil: a tenth of an ephah, half in the morning and half in the evening.", sources: ['Vayikra 6:13–14', 'Menachot 4:5'] },
    inAction: [{ event: 'chavitin-bakers', label: { en: 'The chavitin on the griddle' } }],
  },
  'fire:altar.kitchen.fire': {
    title: { en: 'The cooking fire', he: 'בית המבשלות' }, aka: ['kitchen', 'cooking'], zone: 'ezrat-kohanim',
    purpose: { en: "The most-holy offerings are eaten within the hangings by male kohanim, prepared in any manner of food, that day and night until midnight; the vessels they are cooked in are scoured and rinsed.", sources: ['Zevachim 5:3', 'Zevachim 11:7'] },
    notes: { en: "Where in the court the meat was cooked is not stated; the model's place.", sources: ['Zevachim 5:3'] },
    inAction: [{ event: 'kodashim-meal', label: { en: 'Kohanim eat the most-holy portions' } }, { event: 'scouring', label: { en: 'Scouring the pots' } }],
    confidence: 'reconstruction',
  },
  'fire:courts.en.nazirites.hearth': {
    title: { en: "The nazirites' fire", he: 'תחת הדוד' }, aka: ['nazir fire', 'pot'], zone: 'en-chamber-nazirites',
    purpose: { en: "In the nazirites' chamber the nazirites cook their shelamim, shave their hair and cast it under the pot.", sources: ['Middot 2:5', 'Nazir 6:8'] },
    inAction: [{ event: 'nazirites', label: { en: 'The hair cast under the pot' } }],
  },
};

// the remaining stairs and flights of the courts' gates: one entry each (the rule of the steps, sourced; the form is the model's)
for (const id of ['azarah.gate.delek.flight', 'azarah.gate.bechorot.flight', 'azarah.gate.mayim.flight', 'azarah.gate.nitzotz.flight', 'azarah.gate.korban.flight']) {
  OBJECTS[id] = {
    title: null, purpose: FLIGHT, notes: FLIGHT_NOTE,
    inAction: id.includes('korban') ? [{ event: 'private-offerings', label: { en: 'Owners lead their animals up' } }] : undefined,
  };
}
for (const [id, o] of Object.entries(OBJECTS)) { if (o.title === null) delete o.title; if (o.inAction === undefined) delete o.inAction; }

// the place each object belongs to where the zone at its base is not it (high Heichal parts, flights, substructures)
const ZONE_OF = {
  'en.music-chambers': 'music-chambers', 'azarah.gate.nikanor.wicket-n': 'nikanor', 'azarah.gate.nikanor.wicket-s': 'nikanor',
  'azarah.chamber.gazit.podium': 'gazit', 'azarah.chamber.gazit.flight': ['gazit', 'chel'], 'azarah.chamber.etz.flight': ['etz-parhedrin', 'chel'],
  'azarah.moked.podium': 'beit-hamoked', 'azarah.moked.flight': ['beit-hamoked', 'chel'], 'altar.kiyor.muchni': 'kiyor', 'altar.kevesh.ramp-yesod': 'kevesh',
  'heichal.otem': 'ulam-steps', 'heichal.ulam.lintels': 'ulam', 'heichal.gate.wicket-n': ['ulam', 'heichal'], 'heichal.gate.wicket-s': ['ulam', 'heichal'],
  'heichal.ta.door-ne': ['ulam', 'taim'], 'heichal.gate.great': ['heichal', 'ulam'], 'heichal.taim.roofs': 'taim-roofs', 'heichal.aliyah.door': ['taim-roofs', 'aliyah'],
  'heichal.windows.f2': 'ulam', 'heichal.chalifot.n.wicket': 'beit-hachalifot', 'heichal.chalifot.s.wicket': 'beit-hachalifot', 'heichal.lul-west': 'azarah',
  'heichal.ceiling.kiyur': 'aliyah', 'heichal.ceiling.dilpah': 'aliyah', 'heichal.ceiling.tikrah': 'aliyah', 'heichal.ceiling.maazivah': 'aliyah',
  'heichal.roof.kiyur': 'roof', 'heichal.roof.dilpah': 'roof', 'heichal.roof.tikrah': 'roof', 'heichal.roof.maazivah': 'roof',
  'azarah.amah-channel': ['azarah', 'bein-haulam-lamizbeach', 'kevesh'], 'heichal.parochet.outer': ['amah-traksin', 'heichal'], 'heichal.parochet.inner': ['amah-traksin', 'kodesh-hakodashim'],
};
for (const [id, z] of Object.entries(ZONE_OF)) {
  const o = OBJECTS[id];
  if (!o) continue;
  const list = Array.isArray(z) ? z : [z];
  o.zone = list[0];
  if (list.length > 1) o.zones = list.slice(1);
}
// pick boxes for the two objects whose element boxes span the whole Mount
{
  const br = SITE.elements['mount.soreg.breaches'];
  const W = (br?.params?.breachWidth ?? 2) / 2, top = br?.box?.max?.[2] ?? 2.7;
  if (br?.params?.stations) {
    OBJECTS['mount.soreg.breaches'].pickBoxes = br.params.stations.map(({ side, pos: [x, y] }) => (side === 'N' || side === 'S'
      ? { min: [x - W, y - 0.6, 0], max: [x + W, y + 0.6, top] } : { min: [x - 0.6, y - W, 0], max: [x + 0.6, y + W, top] }));
  }
  const ch = SITE.elements['azarah.amah-channel'];
  if (ch?.params?.openSegments) OBJECTS['azarah.amah-channel'].pickBoxes = ch.params.openSegments.map((b) => ({ min: b.min.slice(), max: b.max.slice() }));
}
for (const o of Object.values(OBJECTS)) if (o.pickBox && !o.pickBoxes) o.pickBoxes = [o.pickBox];

/** movable / fx ids → the object id they stand for */
export const ALIASES = {};
for (const [id, o] of Object.entries(OBJECTS)) for (const a of o.aliases || []) if (a !== id) ALIASES[a] = id;

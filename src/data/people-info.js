// =============================================================================
// Mikdash — PEOPLE INFO  (src/data/people-info.js, owner: inspect — console-design §6.2)
// =============================================================================
// Who the figures are, what they wear and what they hold: the text of the inspect cards for people and animals.
// Every role in src/people/roles.js, every animal kind and every prop the choreographies use has an entry.
//
//   ROLES_INFO[role]   = { title: { en, he }, who: { en, sources }, attire: { en, sources }, glossary?, notes? }
//   ANIMALS_INFO[kind] = { title: { en, he }, what: { en, sources }, glossary? }
//   PROPS_INFO[prop]   = { title: { en, he? }, what: { en, sources } | null, glossary? }
//   ROLE_PARTICIPANTS[role] = the schedule's participant roles that count as this role (the role card's "where now")
//
// Rules (as the rest of the data): every sentence is sourced; figures are role slots, never named individuals; where
// the sources prescribe nothing (the Levites' and the laity's dress) the entry says so and the model's choice is labelled
// a reconstruction. Text checked against the report (Parts VIII §27, §34; XIII) and the Hebrew of Tamid, Middot and Yoma.
// =============================================================================

const KOHEN_DRESS = {
  en: "Four garments, all of white linen: the ketonet, a tunic woven in the checkered weave, close-fitting; the michnasayim, breeches from the loins to the thighs; the avnet, a sash about three fingers wide and thirty-two amot long, wound round and round over the heart; and the migba'at, a wound linen headdress. He serves barefoot — nothing may come between his feet and the floor. The garments must fit; soiled ones are not washed but put aside for wicks. The avnet is sha'atnez (wool on linen) and is worn only in the service itself.",
  sources: ['Yoma 7:5', 'Shemot 28:39–42', 'Rambam KhM 8:16–19', 'Zevachim 24a', 'Rambam KhM 8:4–5', 'Yoma 12b', 'Rambam KhM 8:11'],
};
const OWN_CLOTHES = {
  en: "His own clothes. The Mishnah prescribes no dress for those who are not kohanim: the tunic and mantle shown are the model's reconstruction. On Har HaBayit no one goes with his staff, his shoes, his money-belt or the dust on his feet.",
  sources: ['Berachot 9:5'],
};
const LEVITE_DRESS = {
  en: "The Mishnah gives the Levites no uniform. The plain light garments shown are the model's reconstruction; the white linen of II Divrei HaYamim 5:12 is said of the First Temple's dedication and is not carried over.",
  sources: ['II Divrei HaYamim 5:12'],
};

export const ROLES_INFO = {
  kohen: {
    title: { en: 'Kohen', he: 'כהן' }, glossary: 'kohen',
    who: {
      en: "A kohen hedyot — an ordinary priest, a male descendant of Aharon. The kohanim served in twenty-four watches (mishmarot), each for a week in turn, changing on Shabbat; each day of the week one family (beit av) of the watch served. From the receiving of the blood on, the service is the kohanim's alone; the daily tasks were assigned by lottery.",
      sources: ['Bamidbar 18:7', 'Taanit 4:2', 'Sukkah 5:8', 'Zevachim 3:1', 'Yoma 2:1–4'],
    },
    attire: KOHEN_DRESS,
  },
  segan: {
    title: { en: 'The segan', he: 'הסגן' }, glossary: 'segan',
    who: {
      en: "The segan, deputy of the Kohen Gadol, at his right hand. When the Kohen Gadol goes up the ramp to burn the limbs the segan is at his right; at the middle of the ramp he takes him by his right hand and brings him up; at the libation the segan stands on the horn of the altar with the flags (sudarin) in his hand and waves them as the wine is poured, and the cymbal and the Levites' song begin.",
      sources: ['Tamid 7:3', 'Yoma 3:9'],
    },
    attire: KOHEN_DRESS,
  },
  kohen_gadol: {
    title: { en: 'The Kohen Gadol', he: 'כהן גדול' }, glossary: 'kohen gadol',
    who: {
      en: "The High Priest. He serves in eight garments; he may offer any portion he chooses and takes a portion first. When he goes up the ramp to offer, the bearers hand him the limbs and he leans on them and throws them on the fire; when he goes into the Heichal to prostrate, three hold him — at his right, at his left and at the precious stones. He alone enters the Kodesh HaKodashim, on Yom Kippur.",
      sources: ['Yoma 7:5', 'Yoma 1:2', 'Tamid 7:1', 'Tamid 7:3', 'Kelim 1:9'],
    },
    attire: {
      en: "The four garments of the kohen and four more: the me'il, a robe all of techelet whose hem is hung with golden bells and pomegranates of dyed wool — he is heard before he is seen; the ephod and the choshen, the breastplate with twelve stones engraved with the names of the tribes; and the tzitz, a band of gold on his forehead engraved 'Holy to the Lord'. Barefoot, like every kohen.",
      sources: ['Yoma 7:5', 'Shemot 28:4–38', 'Rambam KhM 9:1–4', 'Zevachim 88b', 'Zevachim 24a'],
    },
  },
  kohen_gadol_white: {
    title: { en: 'The Kohen Gadol (in white)', he: 'כהן גדול בבגדי לבן' }, glossary: 'kohen gadol',
    who: {
      en: "The Kohen Gadol on Yom Kippur, for the day's own service, in which he goes into the Kodesh HaKodashim four times.",
      sources: ['Yoma 7:4', 'Kelim 1:9', 'Vayikra 16:4'],
    },
    attire: {
      en: "Four garments of white linen — tunic, breeches, sash and turban — of fine linen: Pelusian linen in the morning, Indian in the afternoon. Barefoot.",
      sources: ['Vayikra 16:4', 'Yoma 3:7', 'Yoma 7:5'],
    },
  },
  kohen_offduty: {
    title: { en: 'Kohen (own clothes)', he: 'כהן בכסות עצמו' }, glossary: 'kohen',
    who: {
      en: "A kohen out of the holy garments. At night the kohanim did not sleep in them: they took them off, folded them, laid them under their heads and covered themselves with their own clothes. Kohanim with a blemish, unfit to serve at the altar, picked over the altar's wood for worms in the wood chamber.",
      sources: ['Tamid 1:1', 'Middot 2:5'],
    },
    attire: { en: "His own clothes; the holy garments folded by his head when he sleeps.", sources: ['Tamid 1:1'] },
  },
  kohen_elder: {
    title: { en: 'Elder of the beit av', he: 'זקן בית אב' }, glossary: 'ziknei beit av',
    who: {
      en: "One of the elders of the family of kohanim serving that day. They slept in Beit HaMoked on the stone ledges (rovadin) round the hall, with the keys of the Azarah in their hands; when the officer came and knocked, they opened to him.",
      sources: ['Tamid 1:1', 'Middot 1:8', 'Tamid 1:2'],
    },
    attire: { en: "In the service, the four white garments of a kohen. Asleep, in his own clothes, the holy garments folded under his head.", sources: ['Tamid 1:1', 'Yoma 7:5'] },
  },
  kohen_elder_offduty: {
    title: { en: 'Elder of the beit av (own clothes)', he: 'זקן בית אב' }, glossary: 'ziknei beit av',
    who: {
      en: "One of the elders of the family of kohanim serving that day, out of the holy garments: they slept in Beit HaMoked on its stone ledges with the keys of the Azarah in their hands and opened to the officer's knock.",
      sources: ['Tamid 1:1', 'Middot 1:8', 'Tamid 1:2'],
    },
    attire: { en: "His own clothes; the holy garments are not slept in.", sources: ['Tamid 1:1'] },
  },
  kohen_breeches: {
    title: { en: 'Kohen (in the breeches)', he: 'כהן במכנסים' }, glossary: 'kohen',
    who: {
      en: "After the third and fourth lotteries, those who had won no task were handed to the attendants (chazanim), who took off their garments and left them only the breeches; the garments were laid in niches marked with the names of the vessels.",
      sources: ['Tamid 5:2–3'],
    },
    attire: { en: "The michnasayim — the linen breeches — only, until he goes out to his own clothes.", sources: ['Tamid 5:3'] },
  },
  kohen_bathing: {
    title: { en: 'Kohen (immersing)', he: 'כהן טובל' }, glossary: 'tevilah',
    who: {
      en: "A kohen who became impure in the night goes out by the winding passage under the Birah, lamps burning on both sides, to the Beit HaTevilah; he goes down and immerses, comes up, dries himself and warms himself at the fire, and sits with his brothers until the gates open. Before dawn whoever wants to clear the altar rises early and immerses before the officer comes.",
      sources: ['Tamid 1:1', 'Tamid 1:2', 'Middot 1:9'],
    },
    attire: { en: "Out of his garments for the immersion; he dries himself and warms himself by the fire. The wrap shown is the model's reconstruction.", sources: ['Tamid 1:1'] },
  },
  levi: {
    title: { en: 'Levi', he: 'לוי' }, glossary: 'levi',
    who: {
      en: "A Levite — of the tribe of Levi, not of Aharon's line. The Levites sang on the duchan over the libations of the daily offerings — never fewer than twelve — with the kinnorot, the nevalim and the one cymbal; they kept the gates, and twenty-one of the twenty-four posts of the night watch. A Levite who hears the crash of the magrefah knows his brothers are going in to sing, and runs.",
      sources: ['Arachin 2:6', 'Arachin 2:5', 'Middot 1:1', 'Tamid 5:6', 'Tamid 7:3'],
    },
    attire: LEVITE_DRESS,
  },
  guard_levi: {
    title: { en: 'Levite of the watch', he: 'לוי שומר' }, glossary: 'levi',
    who: {
      en: "A Levite of the night watch. The Levites kept twenty-one posts: the five gates of Har HaBayit, its four inner corners, the five gates of the Azarah, its four outer corners, Lishkat HaKorban, Lishkat HaParochet and behind the Beit HaKaporet. The officer of the Mount (Ish Har HaBayit) went round every post with torches burning before him. The greeting was 'Shalom alecha': the Mishnah can be read that he says it to a guard who is not standing; the Rambam reads it that a guard who does not stand and say to him 'Ish Har HaBayit, shalom alecha' is plainly asleep. One found asleep he struck with his staff, and he might burn his garment. By day Levites kept the gates.",
      sources: ['Middot 1:1', 'Middot 1:2', 'Rambam BhB 8:4–10'],
    },
    attire: LEVITE_DRESS,
  },
  levi_boy: {
    title: { en: 'Levite boy', he: 'צעיר הלויים' }, glossary: 'levi',
    who: {
      en: "The young sons of the Levites came into the Azarah only while the Levites stood singing, and sang with the voice, not with instruments, 'to add sweetness to the melody'. R' Eliezer ben Yaakov: they were not counted among the twelve and did not stand on the platform but on the ground, their heads between the Levites' feet, and they were called 'the tormentors of the Levites'.",
      sources: ['Arachin 2:6', 'Arachin 13b'],
    },
    attire: LEVITE_DRESS,
  },
  israelite: {
    title: { en: 'Israelite', he: 'ישראל' }, glossary: 'yisrael',
    who: {
      en: "An Israelite — neither kohen nor Levite. He may enter the Ezrat Kohanim only to lean on his offering, to slaughter it or to wave it. Delegations of Israelites, the ma'amadot, stood in turn over the daily offering: 'how can a man's offering be brought and he not stand over it?'",
      sources: ['Kelim 1:8', 'Taanit 4:2'],
    },
    attire: OWN_CLOTHES,
  },
  nazir: {
    title: { en: 'Nazir', he: 'נזיר' }, glossary: 'nazir',
    who: {
      en: "One who vowed to be a nazir — no wine, no cutting of the hair, no impurity of the dead. At the end of his term he brings a ewe lamb for a chatat, a lamb for an olah and a ram for shelamim, with a basket of loaves; in the nazirites' chamber, the south-east chamber of Ezrat Nashim, he cooks his shelamim, shaves his hair and casts it under the pot.",
      sources: ['Bamidbar 6:1–21', 'Middot 2:5', 'Nazir 6:8'],
    },
    attire: { en: "His own clothes; his hair long and uncut through his term (the dress shown is the model's reconstruction).", sources: ['Bamidbar 6:5'] },
  },
  nazir_shaven: {
    title: { en: 'Nazir (shaven)', he: 'נזיר שגילח' }, glossary: 'nazir',
    who: {
      en: "A nazir whose term is done: his head shaved in the nazirites' chamber, the hair cast into the fire under the pot of his shelamim; a kohen then waves the cooked foreleg with a loaf and a wafer on his palms.",
      sources: ['Bamidbar 6:18–19', 'Middot 2:5', 'Nazir 6:8–9'],
    },
    attire: { en: "His own clothes; his head shaved.", sources: ['Bamidbar 6:18'] },
  },
  metzora: {
    title: { en: 'Metzora (healed)', he: 'מצורע' }, glossary: 'metzora',
    who: {
      en: "A metzora on the eighth day of his purification. He immerses in the lepers' chamber in the north-west of Ezrat Nashim and stands in Sha'ar Nikanor — its gateway was left without the court's sanctity so that he could stand in it — and puts his head, then his hand, then his foot within, for the blood of his asham and then the oil on his right ear, thumb and toe.",
      sources: ['Negaim 14:8–10', 'Middot 2:5', 'Yoma 30b–31a', 'Vayikra 14:10–20'],
    },
    attire: { en: "On the seventh day he shaves all his hair — head, beard and eyebrows — and washes his garments; his own clothes.", sources: ['Vayikra 14:8–9'] },
  },
  mourner: {
    title: { en: 'Mourner', he: 'אבל' }, glossary: 'avel',
    who: {
      en: "All who come onto Har HaBayit enter by the right, go round and leave by the left — but a mourner goes round to the left. Those he meets ask, 'Why do you go round to the left?' — 'I am a mourner' — 'May He who dwells in this House comfort you.'",
      sources: ['Middot 2:2'],
    },
    attire: { en: "Wrapped about the head and face, as mourners wrapped themselves; the black dress shown is the model's reconstruction.", sources: ['Moed Katan 24a'] },
  },
  menudeh: {
    title: { en: 'One under a ban', he: 'מנודה' }, glossary: 'menudeh',
    who: {
      en: "One under a ban goes round Har HaBayit to the left, against the stream. Asked why, he answers 'I am under a ban', and they say 'May He who dwells in this House put it in their hearts to bring you near' — so R' Meir; R' Yosi: 'May He who dwells in this House put it in your heart to listen to your fellows, and they will bring you near.'",
      sources: ['Middot 2:2'],
    },
    attire: { en: "Wrapped as a mourner; the dress shown is the model's reconstruction.", sources: ['Moed Katan 15a'] },
  },
  woman: {
    title: { en: 'Woman', he: 'אשה' },
    who: {
      en: "Women came up to the Ezrat Nashim. A woman does not lean on her offering. After childbirth, a mother brings a lamb for an olah and a bird for a chatat, or two birds, and stands in the gateway of Nikanor while they are offered for her.",
      sources: ['Middot 2:5', 'Menachot 9:8', 'Vayikra 12:6–8', 'Sotah 1:5'],
    },
    attire: { en: "Her own clothes, the head covered; cut and colours are the model's reconstruction.", sources: ['Ketubot 7:6'] },
  },
  elder: {
    title: { en: 'Elder', he: 'זקן' },
    who: {
      en: "An elder of Israel. At the crash of the magrefah the head of the ma'amad stationed the impure at the eastern gate; the Israelites of the ma'amad stood over the daily offering.",
      sources: ['Tamid 5:6', 'Taanit 4:2'],
    },
    attire: OWN_CLOTHES,
  },
  sanhedrin: {
    title: { en: 'Judge of the Great Sanhedrin', he: 'דיין בסנהדרי גדולה' }, glossary: 'sanhedrin',
    who: {
      en: "One of the seventy-one of the Great Sanhedrin, who sat in Lishkat HaGazit — in its unsanctified half, for no one sits in the Azarah — 'like half a round threshing floor, so that they see one another', two scribes standing before them. They sat from the morning tamid to the afternoon tamid, and on Shabbat and festivals in the Chel. They judged the priesthood: a kohen found unfit put on black and went out; one found fit put on white and went in to serve.",
      sources: ['Middot 5:4', 'Sanhedrin 4:3', 'Sanhedrin 88b', 'Yoma 25a'],
    },
    attire: { en: "His own clothes, wrapped in his mantle; the sources describe no robe of office — the dress shown is the model's reconstruction.", sources: ['Middot 5:4'] },
  },
  child: {
    title: { en: 'Child', he: 'ילד' },
    who: {
      en: "Children came up with their families. Of children, the Mishnah exempts from the duty to appear on the festivals only the small child who cannot ride on his father's shoulders from Jerusalem up to Har HaBayit (Beit Shammai; Beit Hillel: who cannot hold his father's hand and walk up).",
      sources: ['Chagigah 1:1'],
    },
    attire: OWN_CLOTHES,
  },
};

/** the schedule's participant roles each people role answers to (role card: "where they are now") */
export const ROLE_PARTICIPANTS = {
  kohen: ['kohen'], segan: ['segan'], kohen_gadol: ['kohen_gadol'], kohen_gadol_white: ['kohen_gadol'],
  kohen_offduty: ['kohen'], kohen_elder: ['elder', 'kohen'], kohen_elder_offduty: ['elder', 'kohen'], kohen_breeches: ['kohen'],
  kohen_bathing: ['kohen'], levi: ['levi', 'guard_levi'], guard_levi: ['guard_levi', 'levi'], levi_boy: ['levi_boy'],
  israelite: ['israelite'], nazir: ['nazir'], nazir_shaven: ['nazir'], metzora: ['israelite'], mourner: ['israelite'],
  menudeh: ['israelite'], woman: ['woman'], elder: ['elder'], sanhedrin: ['sanhedrin'], child: [],
};

export const ANIMALS_INFO = {
  lamb: {
    title: { en: 'Lamb', he: 'כבש' }, glossary: 'tamid',
    what: {
      en: "A male lamb in its first year. The tamid is two lambs a day, one at dawn and one in the afternoon; no fewer than six inspected lambs were kept in the lamb chamber of Beit HaMoked, checked again by torchlight and watered from a gold cup before the slaughter. Lambs were also individuals' olot and shelamim.",
      sources: ['Bamidbar 28:3–4', 'Arachin 2:5', 'Tamid 3:3–4', 'Vayikra 1:10'],
    },
  },
  ram: {
    title: { en: 'Ram', he: 'איל' },
    what: {
      en: "A ram — a male sheep past its first year: the nazir's shelamim, and the asham for theft and for me'ilah.",
      sources: ['Bamidbar 6:14', 'Vayikra 5:15', 'Vayikra 5:25'],
    },
  },
  goat: {
    title: { en: 'Goat', he: 'עז' },
    what: { en: "A male goat, fit as an olah or a shelamim of the flock; a male goat is the chatat of a ruler.", sources: ['Vayikra 1:10', 'Vayikra 3:12', 'Vayikra 4:23'] },
  },
  ewe: {
    title: { en: 'Ewe lamb', he: 'כבשה' },
    what: { en: "A female lamb: the individual's chatat (kisbah), and the chatat of the nazir and of the metzora.", sources: ['Vayikra 4:32', 'Bamidbar 6:14', 'Vayikra 14:10'] },
  },
  she_goat: {
    title: { en: 'She-goat', he: 'שעירת עזים' },
    what: { en: "A she-goat: the individual's chatat for an unwitting sin.", sources: ['Vayikra 4:28'] },
  },
  bull: {
    title: { en: 'Bull', he: 'פר' },
    what: { en: "A bull of the herd, fit as an olah or shelamim; bulls are brought for the musaf of Rosh Chodesh and the festivals. A bull's olah needs twenty-four kohanim to carry it up.", sources: ['Vayikra 1:3', 'Bamidbar 28:11', 'Yoma 2:7'] },
  },
  dove: {
    title: { en: 'Young pigeon', he: 'בן יונה' }, glossary: 'bnei yonah',
    what: { en: "Young pigeons (bnei yonah) — bird offerings of the poor, of the mother after childbirth, of the healed zav and zavah. A bird is not slaughtered: the kohen nips its neck with his fingernail (melikah) at the corner of the altar.", sources: ['Vayikra 1:14–15', 'Vayikra 12:8', 'Zevachim 6:4–5', 'Chullin 1:5'] },
  },
  pigeon: {
    title: { en: 'Young pigeon', he: 'בן יונה' }, glossary: 'bnei yonah',
    what: { en: "Young pigeons (bnei yonah) — bird offerings of the poor, of the mother after childbirth, of the healed zav and zavah. A bird is not slaughtered: the kohen nips its neck with his fingernail (melikah) at the corner of the altar.", sources: ['Vayikra 1:14–15', 'Vayikra 12:8', 'Zevachim 6:4–5', 'Chullin 1:5'] },
  },
  turtledove: {
    title: { en: 'Turtledove', he: 'תור' }, glossary: 'torim',
    what: { en: "Turtledoves (torim) — the other kind of bird offering, fit when grown, as young pigeons are fit when young; offered by melikah at the corner of the altar.", sources: ['Vayikra 1:14', 'Chullin 1:5', 'Zevachim 6:4–5'] },
  },
};

// ------------------------------------------------------------------------------------------------- props
const LIMB_BEARERS = "The parts of the tamid, each carried by the one who won it in the second lottery: the head and the right hind leg; the two forelegs; the tail and the left hind leg; the chest and the neck; the two flanks; the innards in a dish with the lower legs on them — then the flour, the chavitin and the wine. They lay them on the lower half of the ramp on its west side and salt them.";
const BURNING = { en: "Limbs and fats on the altar's fire: they burn all night until dawn; what the fire has not consumed by morning is pushed to the sides of the altar and later put back on the fire.", sources: ['Berachot 1:1', 'Tamid 2:1', 'Tamid 2:5'] };
const HUNG = { en: "Hung by the leg from an iron hook of the dwarf pillars to be flayed: 'he did not break the leg but pierced it at the knee and hung it by it'; flayed down to the chest, then cut into its parts.", sources: ['Tamid 4:2', 'Tamid 3:5', 'Middot 3:5'] };
const SLAIN = { en: "The offering just slaughtered at the rings, before it is hung on a hook of the dwarf pillars and flayed.", sources: ['Middot 3:5', 'Tamid 4:2'] };
const HIDE = { en: "The hides of the olah and of the most-holy offerings go to the kohanim; they were salted in Lishkat HaParvah.", sources: ['Zevachim 12:2–3', 'Middot 5:3'] };

export const PROPS_INFO = {
  torch: { title: { en: 'Torch', he: 'אבוקה' }, what: { en: "Torches lit the dawn inspection of the Azarah — two companies, each with burning torches; the tamid lamb was checked again by torchlight; the officer of the Mount went his rounds with torches burning before him.", sources: ['Tamid 1:3', 'Tamid 3:4', 'Middot 1:2'] } },
  trumpet: { title: { en: 'Silver trumpet', he: 'חצוצרה' }, glossary: 'chatzotzrot', what: { en: "One of two silver trumpets blown by kohanim — teki'ah, teru'ah, teki'ah — at the opening of the gates and at the libation, standing on the table of the fats; hammered of silver.", sources: ['Bamidbar 10:2', 'Tamid 7:3', 'Sukkah 5:5'] } },
  shofar: { title: { en: 'Shofar', he: 'שופר' }, glossary: 'shofar', what: { en: "On Rosh HaShanah in the Mikdash the shofar — a straight ibex horn, its mouth plated with gold — was blown between two trumpets.", sources: ['Rosh HaShanah 3:3'] } },
  chalil: { title: { en: 'Chalil (pipe)', he: 'חליל' }, glossary: 'chalil', what: { en: "The pipe played before the altar on twelve days of the year; no fewer than two and no more than twelve; of reed, for its sound is sweeter.", sources: ['Arachin 2:3', 'Arachin 10b'] } },
  kinnor: { title: { en: 'Kinnor (lyre)', he: 'כנור' }, glossary: 'kinnor', what: { en: "The Levites' lyre: no fewer than nine kinnorot played on the duchan, and more might be added.", sources: ['Arachin 2:5'] } },
  nevel: { title: { en: 'Nevel (harp)', he: 'נבל' }, glossary: 'nevel', what: { en: "No fewer than two nevalim and no more than six were played with the song.", sources: ['Arachin 2:5'] } },
  cymbal: { title: { en: 'Cymbal (tziltzal)', he: 'צלצל' }, glossary: 'tziltzal', what: { en: "One cymbal only. As the wine was poured and the segan waved the flags, Ben Arza struck the cymbal and the Levites began the song.", sources: ['Arachin 2:5', 'Tamid 7:3', 'Shekalim 5:1'] } },
  machtah_silver: { title: { en: 'Silver coal pan', he: 'מחתת הכסף' }, glossary: 'machtah', what: { en: "The silver pan kept in the angle between the ramp and the altar, on the ramp's west. With it the winner of terumat hadeshen took up the inner, consumed coals; for the incense the coals were scooped in silver and emptied into a pan of gold.", sources: ['Tamid 1:4', 'Tamid 5:5'] } },
  machtah_gold: { title: { en: 'Gold coal pan', he: 'מחתה של זהב' }, glossary: 'machtah', what: { en: "The coals for the incense, scooped from the altar in the silver pan, are emptied into a pan of gold; about a kav spills and is swept into the channel. In the Heichal its bearer heaps the coals on the golden altar and spreads them with the pan's edge.", sources: ['Tamid 5:5', 'Tamid 6:2', 'Yoma 4:4'] } },
  machtah_gold_yk: { title: { en: 'Coal pan of Yom Kippur', he: 'מחתה של יום הכפורים' }, glossary: 'machtah', what: { en: "On Yom Kippur the Kohen Gadol scoops with a pan of gold itself — of red gold, light, with a long handle — of three kav.", sources: ['Yoma 4:4'] } },
  teni: { title: { en: 'Teni (gold basket)', he: 'טני' }, glossary: 'teni', what: { en: "Like a large gold basket holding two and a half kav. The one who won the clearing of the inner altar took the ashes into it with his hands.", sources: ['Tamid 3:6', 'Tamid 3:9', 'Tamid 6:1'] } },
  kuz: { title: { en: 'Kuz (gold jug)', he: 'כוז' }, glossary: 'kuz', what: { en: "Like a large gold pitcher. The one who dresses the Menorah's lamps sets it on the second step of the stone before the Menorah, and takes it from there when he is done.", sources: ['Tamid 3:6', 'Tamid 3:9', 'Tamid 6:1'] } },
  flask: { title: { en: 'Flask', he: 'צלוחית' }, glossary: 'tzelochit', what: { en: "A flask (tzelochit); on Sukkot a gold flask holding three log was filled from the Shiloach and brought the water for the libation.", sources: ['Sukkah 4:9'] } },
  kaf: { title: { en: 'Kaf (incense ladle)', he: 'כף' }, glossary: 'kaf', what: { en: "Like a large gold basket holding three kav; the dish (bazach), full and heaped with incense, sat inside it, under a cover with a kind of cloth over it. The one who won the incense took it.", sources: ['Tamid 5:4'] } },
  kaf_covered: { title: { en: 'Kaf (with its cover)', he: 'כף וכסויה' }, glossary: 'kaf', what: { en: "The incense ladle with its cover: a large gold vessel of three kav holding the dish heaped with incense. At the blessing on the Ulam steps five held the five vessels — the teni, the kuz, the pan, the dish, and the kaf with its cover.", sources: ['Tamid 5:4', 'Tamid 7:2'] } },
  bazach: { title: { en: 'Bazach (dish)', he: 'בזך' }, glossary: 'bazach', what: { en: "A dish. The incense dish, full and heaped, sat in the kaf; in the Heichal its owner gives it to his friend or relative, who pours it into his hands. The sixth bearer of the tamid carried the innards in a bazach, the lower legs on top.", sources: ['Tamid 5:4', 'Tamid 6:3', 'Tamid 4:3'] } },
  mizrak_gold: { title: { en: 'Mizrak (gold basin)', he: 'מזרק של זהב' }, glossary: 'mizrak', what: { en: "A basin, one of the altar's vessels. At the slaughter the receiver catches the blood in a service vessel and carries it to the altar. On Pesach the kohanim stood in rows holding basins of gold and of silver — a row all gold, a row all silver — and the basins had no flat bases, lest they be set down and the blood congeal.", sources: ['Shemot 27:3', 'Tamid 4:1', 'Pesachim 5:5'] } },
  mizrak_silver: { title: { en: 'Mizrak (silver basin)', he: 'מזרק של כסף' }, glossary: 'mizrak', what: { en: "A basin, one of the altar's vessels. At the slaughter the receiver catches the blood in a service vessel and carries it to the altar. On Pesach the kohanim stood in rows holding basins of silver and of gold — a row all silver, a row all gold — and the basins had no flat bases.", sources: ['Shemot 27:3', 'Tamid 4:1', 'Pesachim 5:5'] } },
  bowl: { title: { en: 'Bowl', he: 'קערה' }, what: null },
  knife: { title: { en: 'Slaughtering knife', he: 'סכין' }, what: { en: "The slaughterer's knife. The knives were kept in Beit HaChalifot, the wings of the Ulam; the tamid's slaughterer stood east of the lamb facing west.", sources: ['Middot 4:7', 'Tamid 4:1'] } },
  knife_flay: { title: { en: 'Flaying knife', he: 'סכין' }, what: { en: "The flayer works down to the chest, cuts off the head and gives it to its bearer, then the lower legs, and so on in the Mishnah's order, each part to the one who won it.", sources: ['Tamid 4:2–3'] } },
  limb: { title: { en: 'A part of the offering', he: 'אבר' }, what: { en: LIMB_BEARERS, sources: ['Tamid 3:1', 'Tamid 4:3', 'Yoma 2:3'] } },
  limb_head: { title: { en: 'The head', he: 'הראש' }, what: { en: "The first bearer holds the head in his right hand, its nose toward his arm, its horns between his fingers, the place of the slaughter uppermost with the fat (peder) laid over it; the right hind leg in his left hand.", sources: ['Tamid 4:3'] } },
  limb_foreleg: { title: { en: 'A foreleg', he: 'היד' }, what: { en: "The second bearer carries the two forelegs, the right in his right hand and the left in his left, the skin outward.", sources: ['Tamid 4:3'] } },
  limb_oketz: { title: { en: 'The tail', he: 'העוקץ' }, what: { en: "The third bearer: the tail in his right hand, the fat tail hanging between his fingers, with the finger of the liver and the two kidneys; the left hind leg in his left hand.", sources: ['Tamid 4:3'] } },
  limb_chazeh: { title: { en: 'The chest', he: 'החזה' }, what: { en: "The fourth bearer: the chest in his right hand and the neck in his left, its ribs between his fingers.", sources: ['Tamid 4:3'] } },
  limb_gerah: { title: { en: 'The neck', he: 'הגרה' }, what: { en: "The fourth bearer: the chest in his right hand and the neck in his left, its ribs between his fingers; the windpipe, the heart and the lungs hang from it.", sources: ['Tamid 4:2–3'] } },
  limb_dofen: { title: { en: 'A flank', he: 'הדופן' }, what: { en: "The fifth bearer carries the two flanks, the right in his right hand and the left in his left, the skin outward.", sources: ['Tamid 4:3'] } },
  entrails_bazach: { title: { en: 'The innards', he: 'הקרבים' }, what: { en: "The sixth bearer carries the innards in a dish, the lower legs on top. The innards were rinsed three times on the marble tables between the pillars; the stomach in the rinsers' chamber.", sources: ['Tamid 4:2–3'] } },
  entrails: { title: { en: 'The innards', he: 'הקרבים' }, what: { en: "The innards are given to their winner to rinse — at least three times, on the marble tables between the pillars; the stomach is rinsed in Lishkat HaMedichin.", sources: ['Tamid 4:2', 'Middot 5:3'] } },
  lamb_carcass: { title: { en: 'The lamb', he: 'הטלה' }, what: HUNG },
  lamb_hung: { title: { en: 'Lamb on the hook', he: 'טלה תלוי' }, what: HUNG },
  carcass_flaying: { title: { en: 'Being flayed', he: 'הפשט' }, what: HUNG },
  carcass_hung: { title: { en: 'Carcass on the hook', he: 'תלוי' }, what: HUNG },
  hide: { title: { en: 'Hide', he: 'עור' }, what: HIDE },
  hide_goat: { title: { en: 'Goat hide', he: 'עור' }, what: HIDE },
  dove_held: { title: { en: 'Bird for the altar', he: 'עוף' }, what: { en: "A bird offering is not slaughtered with a knife: the kohen nips the neck with his fingernail at the corner of the altar — the olat ha'of above the red line at the south-east, the chatat ha'of below it at the south-west.", sources: ['Vayikra 1:15', 'Zevachim 6:4–5', 'Zevachim 64b'] } },
  bird_cage: { title: { en: 'Turtledoves', he: 'תורים' }, what: { en: "A pair of birds (a ken): one a chatat and one an olah — the offering of a mother after childbirth who cannot afford a lamb, and of the healed zav and zavah.", sources: ['Vayikra 12:8', 'Vayikra 15:14', 'Kinnim 1:1'] } },
  bird_cage_pigeons: { title: { en: 'Young pigeons', he: 'בני יונה' }, what: { en: "A pair of birds (a ken): one a chatat and one an olah — the offering of a mother after childbirth who cannot afford a lamb, and of the healed zav and zavah.", sources: ['Vayikra 12:8', 'Vayikra 15:14', 'Kinnim 1:1'] } },
  cup_gold: { title: { en: 'Gold cup', he: 'כוס של זהב' }, what: { en: "Before the slaughter the tamid lamb was given water from a gold cup; though it had been checked the evening before, it was checked again by torchlight.", sources: ['Tamid 3:4'] } },
  fork: { title: { en: 'Fork (tzinorah)', he: 'צינורא' }, glossary: 'tzinorot', what: { en: "With the shovels and the forks the brothers clear the altar, pushing the limbs and fats not yet consumed to its sides; with a fork the limbs are turned on the fire.", sources: ['Tamid 2:1', 'Yoma 12b'] } },
  machavat: { title: { en: 'Griddle (machavat)', he: 'מחבת' }, glossary: 'machavat', what: { en: "A flat griddle: a meal-offering made on it with oil, broken into pieces.", sources: ['Vayikra 2:5–6', 'Menachot 5:8'] } },
  marcheshet: { title: { en: 'Deep pan (marcheshet)', he: 'מרחשת' }, glossary: 'marcheshet', what: { en: "A deep pan: a meal-offering made in it with oil.", sources: ['Vayikra 2:7', 'Menachot 5:8'] } },
  solet: { title: { en: 'Fine flour (solet)', he: 'סלת' }, glossary: 'solet', what: { en: "The seventh bearer of the tamid carries the fine flour of its meal-offering — a tenth of an ephah mixed with oil.", sources: ['Tamid 4:3', 'Bamidbar 28:5'] } },
  chavitin: { title: { en: 'Chavitin', he: 'חביתין' }, glossary: 'chavitin', what: { en: "The eighth bearer carries the Kohen Gadol's daily chavitin: a tenth of an ephah made on a griddle with oil, half offered in the morning and half in the evening.", sources: ['Tamid 4:3', 'Vayikra 6:13–14', 'Menachot 4:5'] } },
  loaves_todah: { title: { en: 'Loaves of the todah', he: 'לחמי תודה' }, glossary: 'lachmei todah', what: { en: "The thanksgiving offering is brought with forty loaves of four kinds — leavened loaves, unleavened loaves, wafers and soaked cakes.", sources: ['Vayikra 7:12–13', 'Menachot 7:1'] } },
  oil_flask: { title: { en: 'Oil', he: 'שמן' }, what: { en: "Oil for the meal-offerings and the libations — three log for a lamb, four for a ram, six for a bull; the metzora's log of oil is waved with his asham.", sources: ['Bamidbar 15:4–10', 'Menachot 9:3', 'Vayikra 14:12'] } },
  wine_jug: { title: { en: 'Wine', he: 'יין' }, glossary: 'nesachim', what: { en: "The ninth bearer carries the wine of the tamid's libation; it is poured at the south-west horn while the segan waves the flags, the cymbal sounds and the Levites sing.", sources: ['Tamid 4:3', 'Tamid 7:3', 'Sukkah 4:9'] } },
  salt: { title: { en: 'Salt', he: 'מלח' }, what: { en: "Every offering is salted; the tamid's parts are laid on the lower half of the ramp and salted there. Salt for the offerings was kept in Lishkat HaMelach.", sources: ['Vayikra 2:13', 'Tamid 4:3', 'Middot 5:3'] } },
  staff: { title: { en: 'Staff', he: 'מקל' }, what: { en: "The officer of the Mount went round every post; a guard he found asleep he struck with his staff, and he might burn his garment.", sources: ['Middot 1:2'] } },
  migbaat: { title: { en: "Migba'at (mitre)", he: 'מגבעת' }, glossary: "migba'at", what: { en: "The kohen's wound linen headdress. At the lottery the officer takes the mitre off one man's head to mark where the count begins.", sources: ['Yoma 7:5', 'Yoma 25a'] } },
  psachter: { title: { en: 'Psachter', he: 'פסכתר' }, glossary: 'psachter', what: { en: "A large vessel holding a letech, with two chains — one to draw it down by, one to hold it from above so it does not roll. It served three things: covered over coals, and over a sheretz on Shabbat, and lowered the ashes from the altar.", sources: ['Tamid 5:5'] } },
  psachter_inverted: { title: { en: 'Psachter (turned over)', he: 'פסכתר' }, glossary: 'psachter', what: { en: "On Shabbat, the coals spilled from the incense pan were covered with the psachter turned over them.", sources: ['Tamid 5:5'] } },
  scroll: { title: { en: 'Scroll', he: 'מגילה' }, what: { en: "Two scribes stand before the Sanhedrin, one at the right and one at the left, and write the words of those who acquit and of those who convict.", sources: ['Sanhedrin 4:3'] } },
  sudar: { title: { en: 'Sudar (flag)', he: 'סודר' }, glossary: 'sudarin', what: { en: "The segan stands on the horn of the altar with the flags in his hand; as the kohen bends to pour the wine he waves them, Ben Arza strikes the cymbal and the Levites begin the song.", sources: ['Tamid 7:3'] } },
  basket: { title: { en: 'Basket', he: 'סל' }, what: { en: "The nazir brings a basket of unleavened loaves and wafers with his offerings; first fruits were brought up in baskets.", sources: ['Bamidbar 6:15', 'Bikkurim 3:8'] } },
  magrefah: { title: { en: 'Magrefah (shovel)', he: 'מגרפה' }, glossary: 'magrefah', what: { en: "The brothers take the shovels and forks and go up to clear the altar. Between the Ulam and the altar one throws down the magrefah — none in Jerusalem could hear his fellow for its sound: the kohanim know their brothers are going in to prostrate, the Levites that their brothers are going in to sing.", sources: ['Tamid 2:1', 'Tamid 5:6'] } },
  lot: { title: { en: 'The lottery', he: 'פייס' }, glossary: 'payis', what: { en: "The kohanim stood in a circle and held out a finger or two; the officer counted round from a chosen man, and the one on whom the count ended won. A thumb was not put out in the Mikdash.", sources: ['Yoma 2:1', 'Yoma 22a', 'Tamid 1:2', 'Tamid 3:1'] } },
  folded_garments: { title: { en: 'Folded holy garments', he: 'בגדי קדש מקופלים' }, glossary: 'bigdei kehunah', what: { en: "They did not sleep in the holy garments: they took them off, folded them, laid them under their heads and covered themselves with their own clothes.", sources: ['Tamid 1:1'] } },
  folded_garments_ledge: { title: { en: 'Folded holy garments', he: 'בגדי קדש מקופלים' }, glossary: 'bigdei kehunah', what: { en: "They did not sleep in the holy garments: they took them off, folded them, laid them under their heads and covered themselves with their own clothes.", sources: ['Tamid 1:1'] } },
  keys: { title: { en: 'Keys of the Azarah', he: 'מפתחות העזרה' }, what: { en: "The elders of the beit av slept with the keys of the Azarah in their hands; at the locking the keys were taken from the chain under the marble slab and hung back on it. Of the two keys the men of the dishun carry, one reaches down to the armpit and one opens directly.", sources: ['Tamid 1:1', 'Middot 1:9', 'Tamid 3:6'] } },
  log: { title: { en: 'Log (gizrin)', he: 'גזירין' }, glossary: 'gizrin', what: { en: "Wood for the altar's piles — any wood but olive and vine; fig, walnut and oil-tree were the custom. Two logs were carried up morning and afternoon.", sources: ['Tamid 2:3', 'Yoma 2:5', 'Yoma 22a'] } },
  gizrin_branch: { title: { en: 'Fig wood', he: 'עצי תאנה' }, what: { en: "Fine fig branches were chosen for the second pile, of the incense, opposite the south-west horn.", sources: ['Tamid 2:5'] } },
  branch_bundle: { title: { en: 'Fig wood', he: 'עצי תאנה' }, what: { en: "Fine fig branches were chosen for the second pile, of the incense, opposite the south-west horn.", sources: ['Tamid 2:5'] } },
  lamb_dead: { title: { en: 'Slain lamb', he: 'טלה שחוט' }, what: SLAIN },
  taper: { title: { en: 'Taper', he: 'פתילה' }, what: { en: "A lamp found gone out is lit again from those still burning — the western lamp from the outer altar — and the lamps are dressed from the stone before the Menorah.", sources: ['Tamid 3:9', 'Tamid 6:1'] } },
  limb_charred: { title: { en: 'Burning limb', he: 'אברים על המערכה' }, what: BURNING },
  limb_head_charred: { title: { en: 'Burning head', he: 'אברים על המערכה' }, what: BURNING },
  limb_foreleg_charred: { title: { en: 'Burning foreleg', he: 'אברים על המערכה' }, what: BURNING },
  limb_oketz_charred: { title: { en: 'Burning tail', he: 'אברים על המערכה' }, what: BURNING },
  limb_chazeh_charred: { title: { en: 'Burning chest', he: 'אברים על המערכה' }, what: BURNING },
  limb_gerah_charred: { title: { en: 'Burning neck', he: 'אברים על המערכה' }, what: BURNING },
  limb_dofen_charred: { title: { en: 'Burning flank', he: 'אברים על המערכה' }, what: BURNING },
  showbread_stack: { title: { en: 'Showbread', he: 'לחם הפנים' }, glossary: 'lechem hapanim', what: { en: "Twelve loaves in two stacks of six on the Shulchan, changed every Shabbat; the old loaves are divided between the outgoing and the incoming watch.", sources: ['Vayikra 24:5–9', 'Menachot 11:7', 'Sukkah 5:7–8'] } },
  showbread_half: { title: { en: 'Showbread', he: 'לחם הפנים' }, glossary: 'lechem hapanim', what: { en: "The old showbread, divided: the incoming watch takes six loaves and divides them in the north, the outgoing six in the south; the kohanim eat it in the court.", sources: ['Sukkah 5:7–8', 'Menachot 11:7'] } },
  bread_piece: { title: { en: 'A piece of the showbread', he: 'פרוסה' }, glossary: 'lechem hapanim', what: { en: "Each kohen's piece of the old showbread, eaten in the court. The Kohen Gadol takes a portion first — whole loaves, never a piece: 'it is not fitting to give a piece to the Kohen Gadol'.", sources: ['Sukkah 5:8', 'Yoma 1:2', 'Yoma 17b', 'Rambam TuM 4:14'] } },
  // the Kohen Gadol's hand (people-info: a role-specific entry, `${prop}:${role}`, wins over the prop's own)
  'bread_piece:kohen_gadol': { title: { en: 'From his own loaves', he: 'לחם הפנים' }, glossary: 'lechem hapanim', what: { en: "He is given whole loaves of the old showbread, never a piece (פרוסה) — 'it is not fitting to give a piece to the Kohen Gadol' — and eats from them in the court.", sources: ['Yoma 1:2', 'Yoma 17b', 'Rambam TuM 4:14'] } },
  lamb_slain: { title: { en: 'Slain lamb', he: 'טלה שחוט' }, what: SLAIN },
  ewe_slain: { title: { en: 'Slain ewe lamb', he: 'כבשה שחוטה' }, what: SLAIN },
  goat_slain: { title: { en: 'Slain goat', he: 'עז שחוטה' }, what: SLAIN },
  she_goat_slain: { title: { en: 'Slain she-goat', he: 'שעירה שחוטה' }, what: SLAIN },
  eimurim: { title: { en: 'Eimurim (the fats)', he: 'אימורים' }, glossary: 'eimurim', what: { en: "The parts burned on the altar: the fat over the innards, the kidneys and their fat, the lobe of the liver — and of a sheep the whole fat tail.", sources: ['Vayikra 3:9–11', 'Vayikra 4:8–10'] } },
  eimurim_goat: { title: { en: 'Eimurim (the fats)', he: 'אימורים' }, glossary: 'eimurim', what: { en: "The parts burned on the altar: the fat over the innards, the kidneys and their fat, and the lobe of the liver.", sources: ['Vayikra 3:14–15', 'Vayikra 4:8–10'] } },
  sal_matzot: { title: { en: 'Basket of matzot', he: 'סל מצות' }, what: { en: "The nazir's basket of unleavened loaves mixed with oil and wafers anointed with oil.", sources: ['Bamidbar 6:15'] } },
  razor: { title: { en: 'Razor', he: 'תער' }, what: { en: "The nazir shaves his head at the end of his term and casts the hair into the fire under the pot of his shelamim.", sources: ['Bamidbar 6:18', 'Middot 2:5'] } },
  clay_pot: { title: { en: 'Earthenware pot', he: 'כלי חרס' }, what: { en: "Holy meat is cooked in the court; an earthenware vessel it was cooked in is broken, a copper one scoured and rinsed. The nazirites cooked their shelamim in their chamber.", sources: ['Vayikra 6:21', 'Zevachim 11:7', 'Middot 2:5'] } },
  clay_pot_broken: { title: { en: 'Broken pot', he: 'כלי חרס' }, what: { en: "An earthenware vessel in which holy meat was cooked is broken.", sources: ['Vayikra 6:21', 'Zevachim 11:7'] } },
  coins: { title: { en: 'Coins', he: 'מעות' }, what: { en: "One who wants libations goes to Yochanan ben Pinchas, gives him money and receives a seal; with the seal he goes to Achiyah, who gives him the libations. In the evening the two reckon the seals against the money.", sources: ['Shekalim 5:4'] } },
  dough: { title: { en: 'Dough', he: 'בצק' }, what: { en: "The showbread is kneaded one loaf at a time and baked two at a time; the house of Garmu was over its making.", sources: ['Menachot 11:2', 'Shekalim 5:1'] } },
  measure: { title: { en: 'Measure', he: 'עשרון' }, glossary: 'isaron', what: { en: "The meal-offering's measure of fine flour, a tenth of an ephah (an isaron).", sources: ['Bamidbar 28:5'] } },
  ram_hung: { title: { en: 'Ram on the hook', he: 'איל תלוי' }, what: HUNG },
  carcass_flaying_ram: { title: { en: 'Ram being flayed', he: 'הפשט' }, what: HUNG },
  carcass_hung_ram: { title: { en: 'Ram on the hook', he: 'תלוי' }, what: HUNG },
  goat_hung: { title: { en: 'Goat on the hook', he: 'עז תלויה' }, what: HUNG },
  carcass_flaying_goat: { title: { en: 'Goat being flayed', he: 'הפשט' }, what: HUNG },
  carcass_hung_goat: { title: { en: 'Goat on the hook', he: 'תלוי' }, what: HUNG },
  ewe_hung: { title: { en: 'Ewe lamb on the hook', he: 'כבשה תלויה' }, what: HUNG },
  carcass_flaying_ewe: { title: { en: 'Ewe lamb being flayed', he: 'הפשט' }, what: HUNG },
  she_goat_hung: { title: { en: 'She-goat on the hook', he: 'שעירה תלויה' }, what: HUNG },
  carcass_flaying_she_goat: { title: { en: 'She-goat being flayed', he: 'הפשט' }, what: HUNG },
};

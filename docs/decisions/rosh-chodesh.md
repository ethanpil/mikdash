# rosh-chodesh — decisions

Rosh Chodesh is the first occasion beside the weekday's day type: its day, its musaf and its song. Files:
`src/time/zmanim.js` (`occasionsOf`), `src/time/index.js` (`occasions`, `occasionsEvening`, `roshChodesh`,
`occasionsAt`, `nextOccasion`), `src/data/schedule.js` (five `rc-*` events, `occasion`, `byOccasion`, `eventsFor(dayType,
time)`), `src/sim/schedule.js`, `src/sim/choreo/rosh-chodesh-musaf.js`, `src/sim/choreo/g7/` (plan, concert),
`src/sim/choreo/describe/rosh-chodesh.js`, G3's `g3/song.js` and `ketoret-morning.js` (the concert), G6's
`g6/musaf.js` and `shabbat-musaf.js` (Shabbat Rosh Chodesh), `tools/validate-schedule.mjs`, `tools/coverage.mjs`,
`src/ui/format.js`, `src/ui/timepanel.js`, `src/search/sources.js`, `src/sim/dev/tests/rosh-chodesh.js`.
Format: **choice** — why (source / reasoning) — alternative. ⚙ = staging (reconstruction).

## The sources read (Sefaria, this session) — claim → citation → Hebrew → how it is staged → confidence

| Claim | Citation | Hebrew (key words) | Staged | Confidence |
|---|---|---|---|---|
| The musaf: two bulls, one ram, seven yearling lambs, olot | Bamidbar 28:11 | וּבְרָאשֵׁי חׇדְשֵׁיכֶם תַּקְרִיבוּ עֹלָה… פָּרִים בְּנֵי בָקָר שְׁנַיִם וְאַיִל אֶחָד כְּבָשִׂים בְּנֵי שָׁנָה שִׁבְעָה תְּמִימִם | 11 animals brought, slaughtered, burned | explicit |
| Flour: 3 tenths a bull, 2 the ram, 1 a lamb, mixed with oil | Bamidbar 28:12–13 | שְׁלֹשָׁה עֶשְׂרֹנִים… לַפָּר הָאֶחָד וּשְׁנֵי עֶשְׂרֹנִים… לָאַיִל… וְעִשָּׂרֹן עִשָּׂרוֹן… לַכֶּבֶשׂ | `solet` carried by the flour men, thrown on the pile | explicit (amounts in text only) |
| Wine: ½, ⅓, ¼ hin | Bamidbar 28:14 (oil the same: 15:4–10) | חֲצִי הַהִין… וּשְׁלִישִׁת הַהִין… וּרְבִיעִת הַהִין | `wine_jug` carried, poured at the SW horn | explicit (amounts in text only) |
| One goat, a chatat | Bamidbar 28:15 | וּשְׂעִיר עִזִּים אֶחָד לְחַטָּאת… עַל עֹלַת הַתָּמִיד יֵעָשֶׂה | the goat, last | explicit |
| Trumpets over the olot on new moons | Bamidbar 10:10 | וּבְרָאשֵׁי חׇדְשֵׁיכֶם וּתְקַעְתֶּם בַּחֲצֹצְרֹת עַל עֹלֹתֵיכֶם | libation-song's two trumpeters, three sets | explicit |
| The musaf right after the morning tamid | Rambam TuM 7:1 | בְרָאשֵׁי חֳדָשִׁים מַקְרִיבִין מוּסַף רֹאשׁ חֹדֶשׁ אַחַר תָּמִיד שֶׁל שַׁחַר | window from the end of the day's song (sunrise + 106) | ordering |
| Every olah done as the tamid; the chatat as the chatat that is eaten | Rambam TuM 7:2 | מַעֲשֵׂה כָּל הָעוֹלוֹת אֶחָד הוּא כְּמַעֲשֵׂה הַתָּמִיד… כְּמַעֲשֵׂה הַחַטָּאת הַנֶּאֱכֶלֶת | binding, blood, flaying, row as the tamid | explicit |
| Libations before the musafim (the order of the day) | Yoma 33a (Abaye) | וְנִסְכִין לְמוּסָפִין, וּמוּסָפִין לְבָזִיכִין | after the tamid's libation and song | ordering |
| The limbs of Rosh Chodesh on the altar between horn and horn, on the walk of the kohanim, to publicise it; salted there | Rambam TuM 6:3 | וְשֶׁל רָאשֵׁי חֳדָשִׁים נוֹתְנִין עַל הַמִּזְבֵּחַ מִלְּמַעְלָה בֵּין קֶרֶן לְקֶרֶן בִּמְקוֹם הִלּוּךְ רַגְלֵי הַכֹּהֲנִים כְּדֵי לְפַרְסְמוֹ שֶׁהוּא רֹאשׁ חֹדֶשׁ. וּמוֹלְחִין שָׁם | laid on the east walk ⚙ side, then on the great pile | sourced reading (Rambam; see the variants below) |
| — the karkov = an amah between horn and horn, the kohanim's walk | Yerushalmi Shekalim 8:4 | אֵי זֶהוּ כַּרְכּוֹב הַמִּזְבֵּחַ. אַמָּה בֵין קֶרֶן לַקֶּרֶן. מְקוֹם הִילּוּךְ רַגְלֵי הַכֹּהֲנִים | (supports the Rambam) | — |
| — variants: Mishnah "below the karkov"; Rashi "the ramp just below it"; Bartenura "the sovev, toward the east" | Shekalim 8:8; Sukkah 54b and Rashi there; Bartenura Shekalim 8:8 | מִתַּחַת כַּרְכֹּב הַמִּזְבֵּחַ מִלְּמָטָה; נתנין היו בכבש סמוך לכרכוב; עַל כַּרְכֹּב… שֶׁהוּא הַסּוֹבֵב. וּכְלַפֵּי הַמִּזְרָח | named in the event text; not staged | — |
| A bull by 24 (head 1, right leg 2, tail 2, left leg 2, breast 1, neck 3, forelegs 2, flanks 2, innards/flour/wine 3 each); a ram by 11 (flesh 5, innards/flour/wine 2 each) | Mishnah Yoma 2:6–7 | אַיִל קָרֵב בְּאַחַד עָשָׂר… פַּר קָרֵב בְּעֶשְׂרִים וְאַרְבָּעָה | crews of 24 / 24 / 11, each carrier his own prop | explicit |
| A lamb (the tamid) by 9, incl. the chavitin man | Yoma 2:5; Tamid 4:3 | תָּמִיד קָרֵב בְּתִשְׁעָה… הַשְּׁמִינִי בַּחֲבִתִּין | 8 to each musaf lamb (no chavitin) | derived ⚙ |
| The row with the limbs, then together to the ramp | Tamid 4:3 | נִמְצְאוּ כֻלָּן עוֹמְדִין בְּשׁוּרָה וְהָאֵבָרִים בְּיָדָם | each crew stands in a row, then walks in a file | explicit (for the tamid) |
| Goats of Rosh Chodesh: north, a vessel, four horns from the sovev SE→NE→NW→SW, rest on the southern yesod, eaten by male kohanim inside, day and night until midnight | Mishnah Zevachim 5:3 | שְׂעִירֵי רָאשֵׁי חֳדָשִׁים… עָלָה בַכֶּבֶשׁ וּפָנָה לַסּוֹבֵב, וּבָא לוֹ לְקֶרֶן דְּרוֹמִית מִזְרָחִית… וְנֶאֱכָלִין לִפְנִים מִן הַקְּלָעִים… עַד חֲצוֹת | the receiver up the ramp, onto the sovev, `sprinkle` at each horn, `pour` at the SW yesod | explicit |
| With the finger, against the point of the horn | Rambam MK 5:7, 5:10 | וְטוֹבֵל אֶצְבָּעוֹ הַיְמָנִית… וְנוֹתֵן בְּקֶרֶן דְּרוֹמִית מִזְרָחִית תְּחִלָּה | as above | explicit |
| An olah's blood: two gifts that are four | Zevachim 5:4 | שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע | NE and SW corners, the rest on the south yesod | explicit |
| The limbs of an olah before a chatat's fats | Zevachim 10:2 | אֵבְרֵי עוֹלָה קוֹדְמִין לְאֵמוּרֵי חַטָּאת | the goat's fats last | explicit |
| Order of the animals: bulls, rams, lambs, goats — a baraita; the Gemara leaves it perhaps to freewill offerings | Zevachim 90a–b | פָּרִים קוֹדְמִין לְאֵילִים… כְּבָשִׂים לִשְׂעִירִים… לֹא, לִנְדָבָה | the verse's order for the slaughter | ordering (verse) |
| Shabbat's musaf before Rosh Chodesh's ("the more frequent first") | Zevachim 10:1; Rambam TuM 9:2 | מוּסְפֵי שַׁבָּת קוֹדְמִין לְמוּסְפֵי רֹאשׁ חֹדֶשׁ | Shabbat RC: the RC musaf after `shabbat-musaf` | explicit |
| Nine blasts more on a day with musafim | Mishnah Sukkah 5:5 | וּבַמּוּסָפִין הָיוּ מוֹסִיפִין עוֹד תֵּשַׁע | libation-song's concert (three sets) | explicit |
| One set of nine for all the musafim (R' Acha refuted); one song after both libations | Sukkah 55a; Rashi there | תְּיוּבְתָּא דְּרַבִּי אַחָא; Rashi: אין אומר אלא שיר אחד ואין כאן אלא תשע תקיעות… ואומרין השיר לאחר שקרבו נסכי שניהם | Shabbat RC: one concert, after the RC musaf | sourced reading (Rashi) |
| Rosh Chodesh's song displaces Shabbat's, to publicise it | Rambam TuM 6:10; Sukkah 54b (R' Yochanan) | שִׁירָה שֶׁל רֹאשׁ חֹדֶשׁ דּוֹחֶה אֶת שִׁירָה שֶׁל שַׁבָּת כְּדֵי לְפַרְסֵם | Shabbat RC: no Ha'azinu; the Shabbat musaf's wine poured without song | explicit |
| — Yerushalmi: the RC song over the Shabbat musaf | Yerushalmi Shekalim 8:4 | שׁוֹחֵט מוּסְפֵי שַׁבָּת וְאוֹמְרִים עֲלֵיהֶן שִׁירוֹ שֶׁלְרֹאשׁ חוֹדֶשׁ | named in the text; not staged | — |
| The song at the pouring; nine blasts on its sections | Rambam TuM 6:5, 6:7 | וּבִשְׁעַת הַנִּסּוּךְ אוֹמְרִין הַלְוִיִּם הַשִּׁיר… וְתוֹקְעִין תֵּשַׁע תְּקִיעוֹת עַל פִּרְקֵי הַשִּׁיר | the concert at the last jug's pour | explicit |
| Song only over the public's obligatory offerings | Rambam TuM 6:8 | אֵין אוֹמְרִין שִׁירָה אֶלָּא עַל עוֹלוֹת הַצִּבּוּר | — (the individuals' offerings have none) | explicit |
| Which psalm on Rosh Chodesh — not given (TuM 6:9 lists the days, Shabbat's musaf and minchah, Rosh HaShanah's musaf and minchah; nothing for Rosh Chodesh). Soferim 19:2 gives Ps 104 for Yom Kippur, not Rosh Chodesh | Rambam TuM 6:9; Tractate Soferim 19:2 | — | Psalm 81 sung as a stand-in, said so in the text and caption | reconstruction |
| Rosh Chodesh may have work done; it has a musaf | Chagigah 18a | רֹאשׁ חֹדֶשׁ יוֹכִיחַ, שֶׁיֵּשׁ בּוֹ קׇרְבַּן מוּסָף, וּמוּתָּר בַּעֲשִׂיַּית מְלָאכָה | the weekday's life goes on (Sanhedrin, chambers, gates, the individuals' offerings) | sourced reading |
| One musaf day: the sanctified day; witnesses after minchah → "this day holy and tomorrow holy, the musaf tomorrow" | Rambam Kiddush HaChodesh 3:5–6 | נוֹהֲגִין אוֹתוֹ הַיּוֹם קֹדֶשׁ וּלְמָחָר קֹדֶשׁ וּמַקְרִיבִין מוּסָף לְמָחָר | `occasionsOf`: the 1st only (see below) | sourced reading |
| On Shabbat the outgoing watch offers the morning tamid and the musafim | Rambam TuM 4:9 | מְפִיסִין בְּשַׁחַר אַנְשֵׁי… מִשְׁמָר הַיּוֹצֵא וּמַקְרִיבִין תָּמִיד שֶׁל שַׁחַר וּשְׁנֵי כִּבְשֵׂי עוֹלָה שֶׁל מוּסָפִין | in the CREW check; the faces are their own | sourced reading |

## The day

- **`dayType` is unchanged; the occasion is a second, orthogonal field** (`time.occasions`, `time.roshChodesh`,
  `occasionsEvening`, `occasionsAt(t)`, `nextOccasion(id)`). — Dozens of readers switch on the three day types; a fourth
  would have to be taught to each, and Rosh Chodesh falls on any of them (a Shabbat Rosh Chodesh is both). — `dayType:
  'rosh-chodesh'`.
- **Rosh Chodesh is the 1st of a month only, not the 30th of a full month.** — While the court sanctified the month on
  sighting, Rosh Chodesh was ONE day, the musaf offered on it alone (Rambam Kiddush HaChodesh 3:5–6). The fixed
  calendar's 30th of a full month is a month not sanctified on its 30th, an ordinary day in the Mikdash; today's two days
  are a later custom of the fixed calendar. So the next Rosh Chodesh after 2 Nov 2026 is **Wed 11 Nov 2026 (1 Kislev)**;
  30 Cheshvan (10 Nov) is ordinary. — Both days (the brief's lead), which would stage the musaf twice a month.
- **1 Tishrei is `rosh-hashanah`, not `rosh-chodesh`.** — It is a festival (its own musaf and song, TuM 6:9, 9:1; the
  shofar; no individuals' offerings); staging only the Rosh Chodesh musaf on it would mislead. It shows an ordinary day,
  as every festival does (Top 9). — Stage the Rosh Chodesh part alone.
- **The occasion belongs to the civil date's DAYTIME**, as dayType does: its small hours are the night before, its
  evening after sunset already the next date (`occasionsEvening`; the UI badge follows `occasionsAt(t)`). — The musaf is
  a daytime service; nothing visible at night belongs to the new month (the night's burning is the day's limbs, as on
  any night). Consistent with Shabbat (`dayType` 'shabbat' small hours = Friday night). — Switch at sunset.

## The schedule

- **Five events, `occasion: 'rosh-chodesh'`, `dayTypes: ALL`:** `rc-musaf-slaughter` (sunrise + 106–124),
  `rc-goat-chatat` (119–129), `rc-musaf-flaying` (108–150), `rc-musaf-limbs` (118–156), `rc-musaf-song` (156–168; choreo
  `libation-song`). On Shabbat (`byDay.shabbat.when`) each 44 minutes later (150 … 212), after `shabbat-musaf`. The
  minutes are the plan's (g7/plan.js), rounded; `timing.confidence` 'ordering' where the order is sourced.
- **On a Rosh Chodesh weekday the individuals' offerings wait for the musaf** (`byOccasion['rosh-chodesh'].when`: the
  stream from sunrise + 168, each event shifted 62 minutes; `metzora` 177–237). — The musaf comes after the tamid (TuM
  7:1) and it holds the north rings, the ramp and the altar's top for an hour; whether individuals' offerings waited is
  not recorded (reconstruction, said in `timing`). — Run both at once (crowded rings, figures through each other).
- **On Shabbat Rosh Chodesh the showbread chain (swap → bazichin → division → the Kohen Gadol's loaves, the altar's day
  tending) moves 62 minutes later.** — The bazichin follow the musafim (Abaye, Yoma 33a; TuM 4:11) — both musafim.
- **`eventsFor(dayType, time)` reads `time.occasions`; with none it is the old function** (every event the same object as
  before: the pre-change baseline's windows match on 7 ordinary dates, and the JSON of every day list is identical but
  for the new `byOccasion` key).
- **`byDay` may carry `when` only on an occasion's event** (validator). — An ordinary event has one window per event, as
  before.

## The staging (g7/plan.js) ⚙

- **A plan of Scripts as G6's (g2/lib.js), not a copy of `shabbat-musaf`'s 600 lines.** One generator for any animal:
  bring-in, binding, slaughter, blood, hanging, flaying, the row, the file, the walk, the flour, the wine; the Shabbat
  musaf's cut-by-cut handing out (Tamid 4:2–3) is kept for the tamid and the Shabbat lambs; here each carrier takes his
  part in turn (two take points), stands in the row (Tamid 4:3) and the crew goes together.
- **Brought by Sha'ar HaKorban, each led by the man who will flay it** (as the Shabbat musaf: the gate Middot 1:5 names,
  the commentators' reading for the most-holy offerings), 0.6 min apart, from 8½ minutes before the window.
- **Rings:** bulls in the last row (y 367.5, x 213 / 221: a bull's body clears the tables), the ram and the goat in the
  east column, the lambs in rows two and three; walking lanes between the ring columns (x 201, 209, 217, 225, 233) so no
  figure crosses a ring column. Three slaughter teams (slaughterer + receiver) at once, in the verse's order; a team's
  next cut waits for its receiver back from the corners.
- **Holders:** two kneel for a lamb or the goat, three for the ram, four (two each side) for a bull.
- **Bulls are flayed on the pavement where they fell, two men kneeling at each, ~19 min** (site.js: from a hook a bull
  would not clear the pavement; how it was done is not recorded). **The bound figure gives way to the flayed carcass**
  (bull-scale props, below): bound until 14 % of the flaying, `bull_flaying` to 72 %, then `bull_dressed` on its spread
  hide until the last part is taken, the hide (`hide_bull`) left lying until the limbs window ends — the lamb's scheme of
  hung states.
- **Lambs, the ram and the goat hang from the dwarf pillars' hooks** (pillars 0–7; the goat on the first lamb's hook,
  free by then), with people-4's hung / flaying / dressed states by kind.
- **The crews:** a bull 24, the ram 11, a lamb 8 (the tamid's nine less the chavitin); a lamb's and the ram's men each
  carry their own share; a bull's limbs that the Mishnah gives to two or three are carried WHOLE by them together (below),
  the innards, flour and wine as their own vessels.
- **Processions one at a time on the east walk** (each file reaches the top when the last one's flour men are done):
  lambs, the ram, then the bulls (their flaying is longest). On the top the file walks the south walk and the east walk
  to the north; each lays his parts on the walk's outer half, "between horn and horn", a breath for all to see, then
  throws them on the great pile, northernmost first, and goes on round to the right and down the west half's east lane.
  When the limbs were taken from the walk to the fire is not recorded.
- **Flour men** come from the chavitin chamber by Nikanor (as G6), up the east half behind the file, wait by the SE
  corner and throw the flour on the fire after the limbs. **Wine men** go up the west half's west lane (the libation goes
  up on the left — Zevachim 6:3) while the file's men come down its east lane, and pour at the SW horn one after another.
  How the musaf's eleven libations were poured is not recorded.
- **The last bull's last jug is laid on the lower ramp's west half (as the tamid's ninth)** and libation-song's pourer
  takes it up for the concert (`rcConcert`), so the song begins with a pour, as Tamid 7:3 has it.
- **The goat's fats go up last** (Zevachim 10:2); its dressed carcass stays on the hook until the limbs window ends (the
  kohanim's meal is not staged; the text says it is eaten in the court until midnight).
- **Figures:** the 11 animals are pooled at boot (warmed: the bull's programs compile behind the loader); the 123 kohanim
  only on the first Rosh Chodesh date the session reaches, spawned as each first shows — an ordinary boot carries none of
  them. Peak ~45 kohanim of the module at once (bull procession), within every tier's budget pass. Props share actors per
  name by their windows (≈ 30 actors for ≈ 150 placements).

## Bull-scale props (bull-props) ⚙

Sources read this session (Sefaria): Mishnah Yoma 2:6–7; Tamid 4:2–3; Tosafot Yom Tov on Yoma 2:7; Rambam Ma'aseh
HaKorbanot 6:4, 6:15–19; Zevachim 12:2; Vayikra 1:6; Middot 3:4 and Bartenura there.

- **A limb given to two or three is carried whole by them, side by side.** — Yoma 2:7 "וְהָרֶגֶל בִּשְׁנַיִם… וְהַגֵּרָה
  בִּשְׁלשָׁה"; Rambam MK 6:18 "הַשֵּׁנִי וְהַשְּׁלִישִׁי מוֹלִיכִין הָרֶגֶל שֶׁל יָמִין", 6:19 "וְלָמָּה לֹא יְחַלְּקוּ הָאֵיבָר הַגָּדוֹל
  שֶׁל שׁוֹר לַחֲלָקִים. שֶׁנֶּאֱמַר וְנִתַּח אֹתָהּ לִנְתָחֶיהָ וְלֹא נְתָחֶיהָ לִנְתָחִים"; Tosafot Yom Tov on Yoma 2:7 "לֹא
  שֶׁהָיוּ מְחַלְּקִים הָאֵבֶר לִשְׁנַיִם… אֶלָּא הָאֵבֶר הַשָּׁלֵם הָיוּ מַקְרִיבִין אוֹתָהּ שְׁנֵי כֹּהֲנִים". So each of the 2–3 men
  carrying "a portion" is ruled out by the sources. How they held it is not recorded: here two abreast 0.634 m apart
  (shoulder to shoulder), the limb across their four palms at the waist (people clip `carry_heavy`); the neck's three
  abreast, the middle man under the neck, the side men under the two ribs each side (Tamid 4:3 "שְׁתֵּי צְלָעוֹת מִכָּאן
  וּשְׁתֵּי צְלָעוֹת מִכָּאן") ⚙. — Alternative: a prop shared by two rigs (a new rig feature); instead the part rides one
  man's right palm (grip 'palm', seated level in `carry_heavy`) and reaches over his partners' palms, every man of a
  group in the same clip and phase (in step) — exact because a bull's crews are pooled at scale 1.
- **A group moves as one (g7/plan.js `bullFile`, rosh-chodesh-musaf.js `follow`).** One Script for the group's centre
  (take, row, file, the top), its men placed dx amot to its left each frame, turning about the centre; each man's own
  Script brings him to his place before the take and home after the toss and is hidden while the group carries. A pure
  function of the clock like everything else (jump-safe).
- **The parts' sizes are the bull's** (rig `bull`: withers 1.3 m, body 1.5 m ≈ 2 × the lamb): the hind leg from the hip
  to below the hock ≈ 0.94 m (the lamb's leg × 2.3 in length, × 2.1 in girth); the head baked from the live bull (in its
  hair, as the lamb's: the flaying ends at the breast before the head is cut, Tamid 4:2), the place of slaughter up with
  the peder on it; the breast × 2.5; a fore leg × 2.6 lengthwise; a flank × 4.2 across; the neck 0.52 m with two ribs a
  side reaching 0.55 m out and the windpipe, heart and lungs hanging from it; the innards in a 0.5 m silver basin, a third
  in each, with the four lower legs (kera'ayim, from the knee, in their hide, Tamid 4:3) on them 2 + 1 + 1. Sizes are
  reconstruction from the rig ⚙.
- **The bull's oketz has no alyah.** — The fat tail is a sheep's (Tamid 4:3 "וְהָאַלְיָה… עִמּוֹ" is said of the
  tamid lamb; Vayikra 3:9 of a sheep). A bull's tail-piece here is the rump with the sacrum's crest, the tail flayed to its
  tip hanging from it, the two kidneys in their suet and the finger of the liver on it (Tamid 4:3 "וְאֶצְבַּע הַכָּבֵד
  וּשְׁתֵּי כְלָיוֹת עִמּוֹ").
- **The carcass stages are the lamb's scheme, on the ground:** the bound figure → `bull_flaying` (the up side flayed from
  the belly to the backbone, its hide fallen back over the back onto the pavement flesh side up; the under side, head and
  lower legs still in the hide: the live bull's own baked mesh cut along the hide's edge) → `bull_dressed` (head off, the
  lower legs off at the knees and hocks, the belly opened and emptied — Tamid 4:2 "קְרָעוֹ וְנִמְצָא כֻלּוֹ גָלוּי לְפָנָיו") on
  `hide_bull`. Built in the bull rig's rest space from its own body lines (animals.js quad) and skinned on the CPU to the
  bound pose at phase 0, the pose the sim holds — so it lies exactly where the figure lay (the bulls' pool at scale 1).
  The parts do not go one by one (as the lamb's hung carcass does not) ⚙.
- **The hide stays where it was spread until the limbs window ends.** — An olah's hide is the kohanim's (Zevachim 12:2
  "עוֹרוֹתֵיהֶן לַכֹּהֲנִים"); who took it away and when is not recorded ⚙.
- **The bull's men take their parts at two points on its east side, alternately, 0.16 min apart; the row stands south of
  the bulls' rings facing east, the head of the file at its east end; the file goes east of the altar, south of it and up
  the ramp's east half.** — The lambs' and the ram's files keep the west route; two or three abreast do not pass between
  the yesod and the amah's channel (1½ amot), so a bull's file takes the east of the court (2½ amot east of the line the
  men go home on), then the ramp's east half as before (Zevachim 6:3) ⚙. On the top each group lays its part on the walk's
  outer half facing east, two or three abreast along the walk, slots spaced by each group's reach.
- **The ram's parts at the ram's size** (Yoma 2:6 "אַיִל קָרֵב בְּאַחַד עָשָׂר, הַבָּשָׂר בַּחֲמִשָּׁה"): the lamb's five
  carriers' parts × 1.22 (CARCASS.ram), its head baked from the ram (its horns) — `limb_*_ram`.
- **Flayers kneel** (people `flay_kneel`) at a bull on the pavement; the knife works at ≈ 0.35 m ⚙.
- **Altar wiping (temple-duties):** people `wipe` — leaning over the yesod, a folded cloth (`wipe_cloth`) under the right
  palm wiped in broad rounds on the wall ≈ 1.5 amot ahead, the left palm braced; the wipers stand 0.6 amah off the yesod
  (was 0.8, out of reach). — Middot 3:4 "רַבִּי אוֹמֵר, כָּל עֶרֶב שַׁבָּת מְלַבְּנִים אוֹתוֹ בְמַפָּה מִפְּנֵי הַדָּמִים";
  Bartenura "מְקַנְּחִים אוֹתָן בְּמַפָּה" (wiping, not whitewash). Was `tend_lamp` with the hanging sudar.
- **Cost:** no new shader programs — every new prop is drawn by the people's existing prop batches with the PROP/FLESH
  materials; LOD1 geometries are 0.2–3.7 k triangles. Six clips (152 frames) more in the atlas of the two serving rigs
  (man, elder). Prop geometry is built on first draw (a Rosh Chodesh date only); the heavy grip is posed on first use.

### Wish list (bull-props)
- The parts do not burn: thrown on the pile they vanish (as every procession's); charred bull-scale twins for the pile.
- The laid parts lie as the lead set them down; a part 1 m long on the outer half of the walk overhangs the edge's line
  slightly at the singles' slots.
- The flayed carcass's fixed coat tint (the bake's) may differ a little from the live bull's seeded coat at the moment
  the figure gives way to `bull_flaying`.

## The song

- **libation-song stages the musaf's concert** (`g3/song.js` musafTimeline takes `rcConcert` on Rosh Chodesh, before
  G6's): its Levites return to the duchan, its trumpeters blow three sets (nine blasts: Sukkah 5:5; Bamidbar 10:10), the
  segan waves, Ben Arza's cymbal, brother 12 pours. — A fallback concert in the module (as G6 keeps), unneeded while G3
  claims it (`claims: ['rc-musaf-song']`).
- **The psalm is a stand-in: Psalm 81** ("תִּקְעוּ בַחֹדֶשׁ שׁוֹפָר", v. 4), with the audio's own verse captions and the
  module's caption saying the psalm is not recorded. — The audio has no Psalm 104 (the later liturgical custom for Rosh
  Chodesh); requested. Psalm 81 is also Thursday's psalm and the Rosh HaShanah musaf's (TuM 6:9): on a Thursday Rosh
  Chodesh it is heard twice.
- **Shabbat Rosh Chodesh: one song, after both musafim** (Sukkah 55a, Rashi); G6 pours the Shabbat musaf's wine with its
  own man and no concert, captioning why (Rambam TuM 6:10). — The Yerushalmi's order (RC's song over the Shabbat musaf).

## UI and tools

- **The date row says "Rosh Chodesh"** (a gold badge from `occasionsAt(t)`, so from the evening before) **and offers
  "Next Rosh Chodesh ›"** (`time.nextOccasion`, same hour); `dayPhrase` says "daytime on Rosh Chodesh, Wednesday" instead
  of "an ordinary". Search lists the `rc-*` rites on other days as "On Rosh Chodesh".
- **validate-schedule checks each day type as an ordinary day and as Rosh Chodesh** (durations, the sources' sequence,
  crews), prints the next four Rosh Chodesh dates; **coverage checks 2026-11-11 (weekday), 2026-12-11 (Friday) and
  2027-01-09 (Shabbat)** and their seams.

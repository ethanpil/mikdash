# source-gaps-staged — decisions

Staging of gaps #5, #6, #8, #1, #4, #2, #7, #3 of [source-gaps.md](source-gaps.md), and three fixes from the UX audit
(search vocabulary, a wrong inspect label). Gap #9 (buying libations with the seals) was not done. Files:
`src/sim/choreo/g6/musaf.js`, `shabbat-musaf.js` (#5); `src/sim/choreo/temple-duties.js` (new: #6, #4, #2, #3),
`describe/duties.js` (new); `gates.js`, `night-watch.js`, `describe/dawn.js` (#8, #1); `shabbat-showbread.js` (#2, the
reeds' state); `g3/song.js`, `g3/day.js`, `describe/sanctuary.js` (#7); `src/data/schedule.js` (seven new events,
`onWeekday`); `src/sim/schedule.js`, `tools/validate-schedule.mjs` (`onWeekday`); `src/search/engine.js`,
`src/search/dev/queries.js` (vocabulary); `describe/tamid.js`, `tamid-morning.js` (the label);
`src/sim/dev/tests/source-gaps.js` (new). Format: **choice** — why — alternative. ⚙ = staging (reconstruction).

## Sources re-opened on Sefaria (Hebrew) — claim → citation → Hebrew → how staged → confidence

| Claim | Citation | Hebrew (key words) | Staged | Confidence |
|---|---|---|---|---|
| The tamid's limbs on the lower half of the ramp, west | Tamid 4:3; Rambam TuM 6:3 | וּנְתָנוּם מֵחֲצִי הַכֶּבֶשׁ וּלְמַטָּה בְּמַעֲרָבוֹ | (unchanged) | explicit |
| The musafin's on its EAST | Rambam TuM 6:3 | וְשֶׁל מוּסָפִין הָיוּ נוֹתְנִין אוֹתָן מֵחֲצִי כֶּבֶשׁ וּלְמַטָּה בְּמִזְרָחוֹ | Shabbat musaf limbs moved to the east lower half; the caption quotes TuM 6:3 | explicit |
| — Shekalim 8:8 as printed has tamid east, musaf west (Sefaria's text) | Shekalim 8:8 | אֵבָרֵי הַתָּמִיד… בַּמִּזְרָח, וְשֶׁל מוּסָפִין… בַּמַּעֲרָב | the Rambam and Tamid 4:3 followed; in every reading the two lie on opposite sides | — |
| Salt thrown on the ramp, even on Shabbat, so the kohanim do not slip carrying wood; not a barrier, the walking not being a service | Rambam TuM 6:3; Eruvin 10:14 | וְזוֹרְקִין מֶלַח עַל גַּבֵּי הַכֶּבֶשׁ אֲפִלּוּ בְּשַׁבָּת כְּדֵי שֶׁלֹּא יַחְלִיק; בּוֹזְקִין מֶלַח עַל גַּבֵּי כֶבֶשׁ בִּשְׁבִיל שֶׁלֹּא יַחֲלִיקוּ | `ramp-salt` (sunrise + 31.5–35, every day): one kohen up the east half and down the west casting salt (pose `salt`) | ordering (with the salting of the limbs); who/when ⚙ |
| Tadi served for nothing; the Chuldah gates and Kiponus for entering and leaving | Middot 1:3 | טָדִי מִן הַצָּפוֹן, לֹא הָיָה מְשַׁמֵּשׁ כְּלוּם | Tadi taken out of the gates that open: shut day and night | sourced reading |
| R. Eliezer ben Yaakov: the kohen with an emission goes out by the passage under the Chel, by Tadi | Middot 1:9 | בַּמְּסִבָּה הַהוֹלֶכֶת תַּחַת הַחֵיל יוֹצֵא וְהוֹלֵךְ לוֹ בְּטָדִי | said in the text; not staged (the model follows the first tanna: the passage under the bira to the Beit HaTevilah, Tamid 1:1) | — |
| Levites are gatekeepers to open the gates and shut the doors | Rambam KhM 3:2 | וְיִהְיוּ מֵהֶן שׁוֹעֲרִין לִפְתֹּחַ שַׁעֲרֵי הַמִּקְדָּשׁ וּלְהָגִיף דַּלְתוֹתָיו | `gates-opened` / `gates-shut`: the night watch's Levite at each gate draws the bar (pose `lock`), steps aside as the leaves swing, bars them at night | explicit (who) |
| Locking and opening at the officer's word; the opening blasts only with his leave | Rambam KhM 7:3; Shekalim 5:1 | עַל פִּיו נוֹעֲלִין וְעַל פִּיו פּוֹתְחִין וְאֵין הַתּוֹקְעִין תּוֹקְעִין… אֶלָּא בִּרְשׁוּתוֹ; בֶּן גֶּבֶר עַל נְעִילַת שְׁעָרִים | in the text (Ben Gever named); no figure for him | explicit |
| Levites guard the five Mount gates and the five Azarah gates (outside); kohanim the Moked and Nitzotz gates | Middot 1:1; Rambam BhB 8:8 | חֲמִשָּׁה, עַל חֲמִשָּׁה שַׁעֲרֵי הַר הַבַּיִת… חֲמִשָּׁה, עַל חֲמִשָּׁה שַׁעֲרֵי הָעֲזָרָה; שֶׁהֲרֵי הַכֹּהֲנִים שׁוֹמְרִים עַל שַׁעַר הַמּוֹקֵד וְעַל שַׁעַר הַנִּיצוֹץ | the nine posts at the gates that open (Tadi's post stands at its shut gate); Moked and Nitzotz swing without a figure, as before | explicit |
| The keys of the Azarah with the elders of the beit av | Tamid 1:1; Rambam BhB 8:5 | וְזִקְנֵי בֵית אָב יְשֵׁנִים שָׁם, וּמַפְתְּחוֹת הָעֲזָרָה בְּיָדָם | unchanged (locking-up at the Moked slab) | explicit |
| Rabbi: every erev Shabbat the altar whitened with a cloth because of the blood; the first tanna: whitewash twice a year | Middot 3:4; Bartenura there | רַבִּי אוֹמֵר, כָּל עֶרֶב שַׁבָּת מְלַבְּנִים אוֹתוֹ בְמַפָּה מִפְּנֵי הַדָּמִים; לֹא פָּלֵיג אַתַּנָּא קַמָּא, אֶלָּא מוֹסִיף | `altar-wiping` (Friday, dayHour 9.8–10.45): three kohanim with cloths (`sudar`, pose `tend_lamp`) along the east face to the NE corner, the north face, the west face to the SW corner | sourced (Rabbi, as Bartenura reads him); who/when/how many ⚙ |
| The kanim: neither setting nor removing overrides Shabbat; out on erev Shabbat, laid along the table | Menachot 11:6 | לֹא סִדּוּר קָנִים וְלֹא נְטִילָתָן דּוֹחֶה אֶת הַשַּׁבָּת, אֶלָּא נִכְנָס מֵעֶרֶב שַׁבָּת וְשׁוֹמְטָן וְנוֹתְנָן לְאָרְכּוֹ שֶׁל שֻׁלְחָן | `kanim-out` (Friday dayHour 10.5–10.75): one kohen at the Shulchan; the reeds hidden from the middle of his visit | explicit; hour ⚙ |
| Put back "on the first day of the week" | Rambam TuM 5:11 | וּבְאֶחָד בְּשַׁבָּת נִכְנָס וּמַכְנִיס אֶת הַקָּנִים בֵּין הַחַלּוֹת | `kanim-in` (Sunday only, `onWeekday: 0`, sunrise + 78–83): the reeds back from the middle of his visit (they were restored at Saturday nightfall before) | sourced reading; by day ⚙ (see below) |
| The crier's call when the time of an offering comes | Rambam KhM 7:2 | כֵּיוָן שֶׁיַּגִּיעַ עֵת הַקָּרְבָּן מַכְרִיז הוּא אוֹ אֶחָד מֵאֲנָשָׁיו… עִמְדוּ כֹּהֲנִים לָעֲבוֹדָה וּלְוִיִּם לַדּוּכָן וְיִשְׂרָאֵל לַמַּעֲמָד | `afternoon-call` (dayHour 7.95–8.05): an unnamed Levite of the officer's men, pose `call`, the `gevini` cue | rule explicit; the afternoon instance, hour and place ⚙ |
| Gevini's call — given at the dawn service | Yoma 20b; Shekalim 5:1; Tamid 3:8 | גביני כרוז מהו אומר: עמדו כהנים לעבודתכם…; גְּבִינֵי כָרוֹז | the dawn `gevini` unchanged; the afternoon caller is not named Gevini | explicit (morning) |
| Hugras ben Levi over the song; the officer over the singers chooses them daily and the blasts are at his word; he would not teach his art; thumb in mouth | Shekalim 5:1; Rambam KhM 7:5; Yoma 3:11; Yoma 38b | הֻגְרַס בֶּן לֵוִי עַל הַשִּׁיר; זֶה שֶׁעַל הַמְשׁוֹרְרִים הוּא בּוֹרֵר בְּכָל יוֹם הַמְשׁוֹרְרִים… וְעַל פִּיו תּוֹקְעִין; הָיָה יוֹדֵעַ פֶּרֶק בַּשִּׁיר וְלֹא רָצָה לְלַמֵּד; מכניס גודלו לתוך פיו | a 13th Levite at the duchan's south end, singing by mouth, no instrument; named in the inspect text and in DUCHAN_TEXT | explicit; place on the duchan ⚙; the thumb not shown |

## Choices

- **#5 Shabbat musaf limbs on the east** — TuM 6:3 explicitly, and Tamid 4:3 puts the tamid's west, so in any reading of
  Shekalim 8:8 the two sets lie apart; the app had both on the west. Lamb A at the east edge, B a column west; the
  carrier stands west of them laying them facing east; the salt pile and the salters mirrored. — Leave them west (the
  printed Shekalim text).
- **#6 the salt as its own event, after the nine leave the ramp** — the Rambam ties it to the salting of the limbs; at
  the moment of laying, the nine fill the lower west half, so the salter goes as they leave for the Shema (sunrise +
  31.5). Once a day (morning). — During the laying; also in the afternoon.
- **#8 Tadi never opens** — Middot 1:3 "served for nothing". The crowds already avoided it. — Open with the others.
- **#1 the gatekeepers are the night watch's own Levites** (Middot 1:1: they stand at the gates at dawn) — no new
  figures, dressed as Levites (`guard_levi`). At dawn each draws the bar (`lock`, 0.4 min), steps 6.2 amot along the wall
  (in the Chuldah passages, back up the passage) while the leaves swing, and steps back to his post; at the locking the
  reverse, barring last. gates.js publishes each gate's times (`gateTimes`) so the two modules agree. — New gatekeeper
  figures beside the guards (two men where the Mishnah has one).
- **The Azarah's and the Mount's gates now shut after the night watch takes its posts** (court: tzeit + 0.8 … 1.6,
  Mount: tzeit + 2.4 … 4.2; before: tzeit − 11 and tzeit + 0 … 1.3) — so a Levite is there to shut them (KhM 3:2). The
  locking-up event's window is unchanged.
- **New events, ordinary days:** `gates-opened` (sunrise − 7.5 … − 5), `gates-shut` (tzeit … + 5.5), `ramp-salt`
  (sunrise + 31.5 … 35), `afternoon-call` (dayHour 7.95 … 8.05), every day; `altar-wiping` (dayHour 9.8 … 10.45) and
  `kanim-out` (dayHour 10.5 … 10.75) on Fridays; `kanim-in` (sunrise + 78 … 83) on Sundays. No existing event's window
  changed (checked on 7 dates against the pre-change baseline).
- **`onWeekday`** — a Sunday-only event; eventsFor(dayType, time) reads `time.weekday`, and without a time it is left
  out (the validator's and coverage's day lists, as before). — A fourth day type for Sunday.
- **#4 who wipes and where** — kohanim (the Ezrat Kohanim's work); the faces where an olah's blood is thrown and the
  remainders poured (Zevachim 5:4); not the horns (the sovev), not the inside of the ramp. The cloth is the `sudar`
  prop, the movement `tend_lamp` (small working strokes at waist height). The twice-yearly whitewash is not staged.
- **#2 by day on Sunday** — "באחד בשבת" could begin at Saturday nightfall; the Heichal's work is by day, so after the
  morning incense and the blessing. The reeds "laid along the table" are not modelled (the movable hides them).
  Note: Rambam KhM 7:1 "עַל הַקָּנִים" is the bird-pairs (קִנִּים, KhM 7:9), not the reeds.
- **#3 the afternoon call: the Rambam's rule applied, not Gevini** — Yoma 20b gives Gevini's cry with the dawn
  (Rav's "keriat hagever"); only the Rambam's general rule covers the afternoon. Staged unnamed, at the dawn call's place,
  just before the afternoon lottery; marked reconstruction. — Morning only.
- **#7 the officer over the song as a 13th Levite** singing by mouth — the Rambam has him choose the singers, so he
  stands with them; the Mishnah names Hugras for its generation. +1 figure on the duchan. — Only text.
- **Search vocabulary** — query-side synonyms (`SYNONYMS`, ×0.85, below any direct match) and question words dropped
  (`STOP`): "sacrifice", "singing", "music", "where do women stand", "bread", "incense", "priest" now find the right
  documents; seven queries added to the test.
- **The "Holding the lamb" label** — the tamid's limb-bearers who stand back at the slaughter (all but the two who
  kneel) and the lamb-fetcher after he hands the lamb over were described as holding it; the texts now follow the pose.

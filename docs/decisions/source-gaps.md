# Source gaps: what the primary texts describe that the app does not yet show

Research pass of 2026-11-13. It covers the ordinary weekday, Friday and Shabbat only; Rosh Chodesh, festivals, Yom Kippur
and Pesach are excluded. Every text cited below was opened on Sefaria in this session and read in Hebrew. Commentaries
used: Bartenura and Tosafot Yom Tov. The app's side was checked by grepping `src/data/*.js` and `src/sim/choreo/**`
and by reading the events' descriptions; staged state was checked in the choreography code.

**Texts read:** Mishnah Tamid 1–7, Middot 1–5, Shekalim 3, 5, 6, 8, Yoma 2 and 3:11, Sukkah 5, Menachot 4 and 11,
Zevachim 5, Bikkurim 3, Sotah 1, Negaim 14, Taanit 2:6–7 and 4, Arakhin 2, Pesachim 5, Kinnim 1, Eruvin 10:11–15.
Bavli: Tamid 28b, Yoma 20b, Yoma 38b, Taanit 27b, Menachot 97a–98a. Rambam: Temidin uMusafin (TuM) 1–6, Beit HaBechirah
(BhB) 2 and 8, Klei HaMikdash (KhM) 3, 4, 6, 7. Vayikra 6:4.

**The app is already very complete.** Almost every act in Tamid 1–7 is staged, down to the chazzanim and the garment
niches (Tamid 5:3), the psachter on Shabbat, Bilgah's ring, the kanim's state on Shabbat, the kinnin chest, the lepers'
chamber, the seals reckoning and the twelve-day chalil. What is left is smaller. It falls into three groups:
1. officers and functionaries the Rambam names who do not appear: the gatekeepers, the crier at the afternoon offering,
   the master of song, and the physician;
2. Friday and Sunday acts: wiping the altar, and pulling out and putting back the kanim;
3. a few placements that contradict the Hebrew.

## Ranking

Score = visitor value (1–3) × certainty (high 3, medium 2, low 1) ÷ cost (S 1, M 2, L 3).

| # | Gap | Kind | Cost | Notice | Certainty | Score |
|---|---|---|---|---|---|---|
| 1 | Gatekeepers open and shut the gates; today the leaves swing by themselves | richer action in `gates-opening` / `gates-closing` | M | 3 | high | 4.5 |
| 2 | Kanim pulled out on Friday and put back on **Sunday** (now: a silent state flip, restored on Saturday night) | new small event + possible error | S | 1–2 | high | 4.5 |
| 3 | The crier's call before the **afternoon** tamid as well | new watchable event (audio) | S | 2 | medium-high | 5 → 4* |
| 4 | Friday: the altar wiped with a cloth because of the blood | new watchable event (Friday only) | S–M | 2 | high | 4 |
| 5 | Shabbat musaf limbs belong on the **east** of the lower ramp, not the west | possible error | S | 1 | high | 3 |
| 6 | Salt strewn on the ramp so the kohanim do not slip, on Shabbat too | new detail / richer action | S | 1 | high | 3 |
| 7 | Hugras ben Levi, officer over the song, on the duchan | new detail + text | S | 1 | high | 3 |
| 8 | Tadi gate opened every morning, though it "served for nothing" | possible error | S | 1 | medium-high | 2.5 |
| 9 | Buying libations by day: seal from Yochanan, wine and oil from Achiyah, Beit Shemanya in use | richer action (private offerings) | M | 2 | high absent / place reconstruction | 2.5 |
| 10 | Carrying the ash out of the city (hotza'at hadeshen) | new watchable event | M–L | 2–3 | high absent / frequency disputed | 2 |
| 11 | Twelve singers by mouth **plus** separate instrumentalists (Rambam) | possible error / richer action | M–L | 2 | medium | 1.6 |
| 12 | No ma'amad at the afternoon tamid on Friday and on Shabbat | possible error | S | 1 | medium-low | 1.5 |
| 13 | A donor's gold leaf, grape or cluster hung on the golden vine | new small event | M | 1–2 | medium | 1.5 |
| 14 | Ben Achiyah, the physician of the kohanim's bowel ailments | new detail / text | S–M | 1 | medium (place unknown) | 1.3 |
| 15 | The ma'amad's reading of Ma'aseh Bereishit from a scroll | new watchable event | M | 1–2 | low-medium (place) | 1.1 |

\*#3 scores 5 on paper. It is ranked third because its source, the Rambam's general rule, is less specific than the
texts behind #1 and #2.

---

## 1. Gatekeepers open and shut the gates
- **Source:** Levites are gatekeepers who open the gates and shut the doors. An officer gives the word to lock and to
  open; the trumpeters blow for the opening only with his leave. That officer is Ben Gever (Shekalim 5:1). At dawn the
  Levites of the night watch are already standing at the five Mount gates and the five Azarah gates (Middot 1:1). The
  kohanim keep the Moked and Nitzotz gates (Rambam BhB 8:8).
- **Who and where:** a Levite at each leaf of `mount.gate.{chuldah-e,chuldah-w,kiponus,shushan}` and
  `azarah.gate.{nikanor,mayim,bechorot,delek,korban}`; kohanim at `azarah.gate.{moked,nitzotz}`; the officer at Nikanor
  beside the trumpeters.
- **When:** the same window as now, sunrise −15 to −1. The reverse happens at the locking, tzeit −15.
- **Citations:**
  - Rambam KhM 3:2 "וְיִהְיוּ מֵהֶן שׁוֹעֲרִין לִפְתֹּחַ שַׁעֲרֵי הַמִּקְדָּשׁ וּלְהָגִיף דַּלְתוֹתָיו"
  - KhM 7:3 "זֶה שֶׁעַל נְעִילַת שְׁעָרִים עַל פִּיו נוֹעֲלִין וְעַל פִּיו פּוֹתְחִין וְאֵין הַתּוֹקְעִין תּוֹקְעִין … לִפְתִיחַת הַשְּׁעָרִים אֶלָּא בִּרְשׁוּתוֹ"
  - Shekalim 5:1 "בֶּן גֶּבֶר עַל נְעִילַת שְׁעָרִים"
  - Middot 1:1
- **App now:** `src/sim/choreo/gates.js` drives every Mount and Azarah leaf with `doorAmount` and no actor. Its only
  pools are the trumpeters, the clearing men and the great-gate opener. `night-watch` ends at sunrise −5 with the
  guards standing beside closed gates. `locking-up` shows only the kohen at the Moked keys slab.
- **Kind and cost:** richer action inside an existing event. M: the guard actors are already posted, so this needs
  swing poses and a hand-off to `gates.js` timing.
- **Dispute to pick a side on:** who holds the Azarah keys.
  - Tamid 1:1 and Rambam BhB 8:5: the elders of the beit av, "וּמַפְתְּחוֹת הָעֲזָרָה בְּיָדָם".
  - KhM 4:17: seven amarkalin, "רָצָה הָאֶחָד לִפְתֹּחַ אֵינוֹ יָכוֹל עַד שֶׁיִּתְכַּנְּסוּ כָּל הָאֲמַרְכּוֹלִין".
  - The simplest course is to stage the swinging (KhM 3:2) and leave the keys to the Moked elders, as now.

## 2. The kanim pulled out on Friday and put back on Sunday
- **Source:** setting or removing the 28 half-reed kanim between the showbread loaves does not override Shabbat. On
  Friday one kohen enters the Heichal, draws them out and lays them along the length of the table. On Sunday he enters
  and puts them back between the loaves.
- **Where and when:** `heichal.shulchan`. The Friday act comes after the afternoon service; the Sunday act by day. Times
  are reconstruction.
- **Citations:**
  - Menachot 11:6 "לֹא סִדּוּר קָנִים וְלֹא נְטִילָתָן דּוֹחֶה אֶת הַשַּׁבָּת, אֶלָּא נִכְנָס מֵעֶרֶב שַׁבָּת וְשׁוֹמְטָן וְנוֹתְנָן לְאָרְכּוֹ שֶׁל שֻׁלְחָן"
  - Rambam TuM 5:11 adds "וּבְאֶחָד בְּשַׁבָּת נִכְנָס וּמַכְנִיס אֶת הַקָּנִים בֵּין הַחַלּוֹת"
- **App now:** `src/sim/choreo/shabbat-showbread.js:195–196` flips `kanim` to false on Friday after mincha ketana +60
  and restores it on the Shabbat date after tzeit +30, with no person shown.
  - The restore is half a day early by the Rambam: it should happen on Sunday by day.
  - `docs/decisions/choreo-adopt.md` logs "until after Shabbat" without the Sunday detail.
- **Kind and cost:** new small event (one kohen, two short visits) plus a timing fix. S.
- **Confidence:** high. The Sunday detail is the Rambam's; I did not find it in the Bavli (Menachot 97a–98a).

## 3. The crier's call at the afternoon offering
- **Source:** the officer over the times, or one of his men, cries out whenever the time of an offering arrives:
  "kohanim to the service, Levites to the duchan, Israel to the ma'amad". Each then goes to his work.
- **Where and when:** the morning call is staged once, at the fifteen steps (`gevini`, alot −72, [263, 330.5, 13.5]).
  The second call would come just before the afternoon tamid (≈ dayHour 8.3–8.4), at the same place, and reuse the
  existing cue in `src/audio/synth/calls.js`.
- **Citations:**
  - Rambam KhM 7:2 "זֶה שֶׁעַל הַזְּמַנִּים … כֵּיוָן שֶׁיַּגִּיעַ עֵת הַקָּרְבָּן מַכְרִיז הוּא אוֹ אֶחָד מֵאֲנָשָׁיו בִּרְשׁוּתוֹ וְאוֹמֵר עִמְדוּ כֹּהֲנִים לָעֲבוֹדָה וּלְוִיִּם לַדּוּכָן וְיִשְׂרָאֵל לַמַּעֲמָד"
  - Yoma 20b, Gevini's call "עִמְדוּ כֹּהֲנִים לַעֲבוֹדַתְכֶם, וּלְוִיִּם לְדוּכַנְכֶם, וְיִשְׂרָאֵל לְמַעֲמַדְכֶם"
  - Shekalim 5:1 "גְּבִינֵי כָרוֹז"
- **App now:** only the dawn event (`src/data/schedule.js` `gevini`). Nothing in the afternoon: grepped "Arise, kohanim",
  "crier", "gevini".
- **Kind and cost:** new watchable event, mostly audio. S.
- **Confidence:** medium-high. The Rambam states a general rule ("when the time of the offering arrives"); no text
  describes the afternoon call specifically. On Shabbat the same rule would cover the musaf (option).

## 4. Friday: the altar wiped with a cloth
- **Source:** the altar was whitewashed with lime twice a year, at Pesach and Sukkot (the app shows this as information).
  Rabbi adds that every Friday it was whitened with a cloth because of the blood. Bartenura reads Rabbi as adding to the
  first view, not disputing it: every Friday they wiped the stones with a cloth because of the blood.
- **Who and where:** a few kohanim with cloths on the `altar.yesod` and the `altar.sovev`, working the walls where blood
  is thrown and poured: the red line (`altar.chut-hasikra`), the NE and SW corners, and the south and west yesod.
- **When:** Friday, after the afternoon tamid's blood (≥ dayHour 9) and before sunset. Not stated in the source:
  reconstruction.
- **Citations:**
  - Middot 3:4 "רַבִּי אוֹמֵר, כָּל עֶרֶב שַׁבָּת מְלַבְּנִים אוֹתוֹ בְמַפָּה מִפְּנֵי הַדָּמִים"
  - Bartenura there "לֹא פָּלֵיג אַתַּנָּא קַמָּא, אֶלָּא מוֹסִיף … דִּבְכָל עֶרֶב שַׁבָּת הָיוּ מְקַנְּחִים אוֹתָן בְּמַפָּה"
- **App now:** `src/data/objects.js:437` and `zones-content.js` cite only the twice-yearly whitewash. Grepped "wipe",
  "cloth", "Middot 3:4" in the schedule and choreography: nothing.
- **Kind and cost:** new watchable event, Friday only. S–M. It is worth more if the altar's walls show blood marks that
  the wiping can fade.
- **Confidence:** high. Who did it is not stated; kohanim are the natural choice in the Ezrat Kohanim.

## 5. Possible error: the Shabbat musaf limbs belong on the east
- **Source:** the tamid's limbs go on the lower half of the ramp on its **west**; the musafin's on its **east**.
- **Citations:**
  - Rambam TuM 6:3 "וְנוֹתְנִין הָאֵיבָרִים מֵחֲצִי כֶּבֶשׁ וּלְמַטָּה בְּמַעֲרָבוֹ. וְשֶׁל מוּסָפִין … בְּמִזְרָחוֹ"
  - Tamid 4:3 "וּנְתָנוּם מֵחֲצִי הַכֶּבֶשׁ וּלְמַטָּה בְּמַעֲרָבוֹ"
  - Shekalim 8:8 exists in two readings, listed by Tosafot Yom Tov:
    - the "book" text (Sefaria's main text, and Rashi): tamid **east**, musaf **west**;
    - Bartenura's reading: tamid **west**, which fits Tamid 4:3, so musaf goes east.
  - Under either reading, the two sets lie on **opposite** sides.
- **App now:** the tamid is on the west (`g2`). The musaf is also on the west:
  - `src/sim/choreo/g6/musaf.js:282`, which places lamb A "in the tamid's column";
  - the caption at `shabbat-musaf.js:34`, which quotes the book reading "וְשֶׁל מוּסָפִין … בַּמַּעֲרָב".
  - The app has mixed the two readings.
- **Fix:** move the musaf columns to the east half of the lower ramp and change the caption to quote Rambam TuM 6:3.
  Cost S.
- **Confidence:** high.

## 6. Salt strewn on the ramp
- **Source:** salt is scattered on the ramp so that the kohanim do not slip, even on Shabbat. The Rambam places it with
  the salting of the limbs on the ramp: "so they do not slip and fall when they walk with the wood to the pile".
- **Citations:**
  - Eruvin 10:14 "בּוֹזְקִין מֶלַח עַל גַּבֵּי כֶבֶשׁ בִּשְׁבִיל שֶׁלֹּא יַחֲלִיקוּ"
  - Rambam TuM 6:3 "וְזוֹרְקִין מֶלַח עַל גַּבֵּי הַכֶּבֶשׁ אֲפִלּוּ בְּשַׁבָּת כְּדֵי שֶׁלֹּא יַחְלִיק וְיִפְּלוּ הַכֹּהֲנִים"
- **App now:** limbs are salted on the ramp (`tamid-morning`, `g6/musaf.js`). Grepped "slip": nothing about the ramp.
- **Staging:** one of the salters casts a handful across `altar.kevesh`; optionally a faint salt scatter on the ramp's
  walking surface after the morning. Salt comes from `azarah.chamber.melach`.
- **Kind and cost:** new detail. S.

## 7. Hugras ben Levi, officer over the song
- **Source:**
  - Hugras ben Levi is named among the fifteen officers.
  - The officer over the singers chooses each day who stands on the duchan, and the blasts over the offerings are
    blown at his word.
  - He knew a technique of the song he would not teach, and the Mishnah lists him among those remembered "for
    disgrace".
  - When he sang he put his thumb in his mouth and a finger among the strings, so that his brother kohanim reeled back.
- **Citations:**
  - Shekalim 5:1 "הֻגְרַס בֶּן לֵוִי עַל הַשִּׁיר"
  - Rambam KhM 7:5 "זֶה שֶׁעַל הַמְשׁוֹרְרִים הוּא בּוֹרֵר בְּכָל יוֹם הַמְשׁוֹרְרִים … וְעַל פִּיו תּוֹקְעִין עַל הַקָּרְבָּנוֹת"
  - Yoma 3:11 "הֻגְרַס בֶּן לֵוִי הָיָה יוֹדֵעַ פֶּרֶק בַּשִּׁיר וְלֹא רָצָה לְלַמֵּד"
  - Yoma 38b "כְּשֶׁהוּא נוֹתֵן קוֹלוֹ בִּנְעִימָה, מַכְנִיס גּוּדָלוֹ לְתוֹךְ פִּיו, וּמַנִּיחַ אֶצְבָּעוֹ בֵּין הַנִּימִין"
- **App now:** nothing found (grepped "Hugras", "הגרס", "song officer"). Ben Arza, by contrast, is staged and named.
- **Staging:** one named figure on `azarah.duchan` (`g3/song.js` LEVITES) directing, plus describer and glossary text.
  The thumb-in-mouth pose is optional.
- **Kind and cost:** new detail and information text. S.

## 8. Possible error: Tadi is opened every morning
- **Source:** Tadi served no use. The Chuldah gates and Kiponus served for entering and leaving; Shushan is named for
  the Parah's procession. Rabbi Eliezer ben Yaakov has the kohen who became impure at night leave by Tadi, by the
  passage under the Chel.
- **Citations:**
  - Middot 1:3 "טָדִי מִן הַצָּפוֹן, לֹא הָיָה מְשַׁמֵּשׁ כְּלוּם"
  - versus "מְשַׁמְּשִׁין כְּנִיסָה וִיצִיאָה" for the others
  - Middot 1:9
- **App now:** `src/sim/choreo/gates.js:24` puts `mount.gate.tadi` in `MOUNT`, so it swings open at every dawn. The
  crowds already avoid it (`g4/mount.js:15`; `night-watch.js:73`).
- **Fix:** keep Tadi shut by day. Cost S.
- **Confidence:** medium-high. "Served for nothing" could be read as "had no regular traffic". Whether Shushan was
  opened daily is an open question; the app opens it.

## 9. Buying libations by day: seal, wine and oil, Beit Shemanya
- **Source:**
  - Whoever needs libations pays Yochanan and receives a seal (calf / male / kid / sinner), then gives the seal to
    Achiyah and receives the libations.
  - The officer over the bird-pairs hands the pairs to the owners.
  - Wine and oil were kept in the south-western chamber of the Ezrat Nashim, Beit Shemanya, which the app models
    (Abba Shaul; Rambam follows).
- **Where and when:** owners of olot, shelamim and todot coming to the seals desk (`offerings.js` station `seals`,
  [217, 409, 16]) and then to Achiyah, all day between the temidim. Jars carried out of `en.chamber.oil`.
- **Citations:**
  - Shekalim 5:4 "מִי שֶׁהוּא מְבַקֵּשׁ נְסָכִים הוֹלֵךְ לוֹ אֵצֶל יוֹחָנָן … נוֹתֵן לוֹ מָעוֹת וּמְקַבֵּל מִמֶּנּוּ חוֹתָם. בָּא לוֹ אֵצֶל אֲחִיָּה … וְנוֹתֵן לוֹ חוֹתָם וּמְקַבֵּל מִמֶּנּוּ נְסָכִים"
  - Rambam KhM 7:12
  - KhM 7:9 "וְזֶה הַמְמֻנֶּה נוֹתֵן הַקִּנִּים לְבַעֲלֵי הַקָּרְבָּנוֹת"
  - Middot 2:5 "שָׁם הָיוּ נוֹתְנִין יַיִן וָשֶׁמֶן, הִיא הָיְתָה נִקְרֵאת לִשְׁכַּת בֵּית שְׁמַנְיָה"
- **App now:**
  - The data has a `sealStep` (`src/data/offerings.js:90`), but `g5/plan.js:531` skips it ("seal, done before he came
    in"), so it is never staged.
  - The `seals` event (dayHour 10.2–10.7) shows only the evening reckoning.
  - `en-chamber-oil` has no activity (only a bounds use in `courts-daily.js:472`).
- **Kind and cost:** richer action inside private offerings. M.
- **Confidence:** high that it is absent. Where Yochanan and Achiyah sat, and that Achiyah drew from Beit Shemanya, is
  reconstruction.

## 10. Carrying the ash out of the city (hotza'at hadeshen)
- **Source:**
  - After the ash is raked onto the tapuach, the heap is brought down with the psachter, the copper vessel holding a
    letech on two chains.
  - Any willing kohan, without a lottery and never one with a blemish, fills vessels with it and carries it outside
    the city, to a place sheltered from strong wind, laying it down gently.
  - On the festivals the heap was left as an adornment. "Never was the kohen lazy to take out the ash."
  - The Torah has the kohen change into other garments to take it out.
- **Citations:**
  - Vayikra 6:4 "וּפָשַׁט אֶת־בְּגָדָיו וְלָבַשׁ בְּגָדִים אֲחֵרִים וְהוֹצִיא אֶת־הַדֶּשֶׁן אֶל־מִחוּץ לַמַּחֲנֶה"
  - Tamid 2:2 "מִיָּמָיו לֹא נִתְעַצֵּל הַכֹּהֵן מִלְּהוֹצִיא אֶת הַדָּשֶׁן"
  - Tamid 5:5 "וּמוֹרִידִין בָּהּ אֶת הַדֶּשֶׁן מֵעַל גַּבֵּי הַמִּזְבֵּחַ"
  - Rambam TuM 2:13 "וְגוֹרְפִין אוֹתָהּ הָעֲרֵמָה בִּפְסַכְתֵּר … וּמוֹרִידִין אוֹתוֹ לְמַטָּה"
  - Rambam TuM 2:14 "כָּל מִי שֶׁיִּרְצֶה מִן הַכֹּהֲנִים מְמַלֵּא מִן הַדֶּשֶׁן … וּמוֹצִיא חוּץ לָעִיר … וְאֵין לְהוֹצָאַת הַדֶּשֶׁן לַחוּץ פִּיּוּס"
  - Rambam TuM 2:15
- **App now:**
  - The tapuach is only heaped (`terumat-hadeshen.js`, `altar.tapuach grow`).
  - The psachter is used only for Shabbat's spilled coals (`g3/morning.js:189`).
  - Grepped "out of the city", "carry ash", "shefech": nothing.
- **Staging:**
  - The psachter lowered by its chains from the altar top.
  - Two to four kohanim in plainer garments carrying baskets out through the Azarah and a Mount gate, toward `kidron`
    or `outside`.
  - Weekdays only; never on festivals.
- **Kind and cost:** new watchable event. M–L, because of the route out of the precinct.
- **Dispute to pick a side on:** how often.
  - The Rambam sets it in the daily order and excepts only the festivals.
  - Bartenura on Tamid 2:2 calls "300 kor" an exaggeration and says the heap was never allowed to grow that large,
    implying removal whenever it grew large.
  - Staging it a few times a week, mid-morning, is a defensible reconstruction.

## 11. Possible error: twelve singers by mouth plus separate instrumentalists
- **Source:**
  - No fewer than twelve Levites stand on the duchan each day to sing by mouth. The song is essentially by mouth.
  - Others stand there playing instruments: Levites, or Israelites of pure lineage. The instrumentalists are not
    counted among the twelve.
  - Instruments: at least two nevalim (no more than six), at least nine kinnorot, one cymbal, at least two trumpets.
  - So the minimum on the duchan is about 12 + 9 + 2 + 1.
  - Arakhin 2:4 disputes who played the chalil: slaves of the kohanim, families who married into the priesthood, or
    Levites.
- **Citations:**
  - Rambam KhM 3:3 "וְאֵין אוֹמְרִין שִׁירָה אֶלָּא בַּפֶּה בְּלֹא כְּלִי … וַאֲחֵרִים הָיוּ עוֹמְדִים שָׁם מְנַגְּנִין בִּכְלֵי שִׁיר. מֵהֶן לְוִיִּם וּמֵהֶן יִשְׂרְאֵלִים מְיֻחָסִין … וְאֵין אֵלּוּ הַמְשׁוֹרְרִים עַל פִּי הַכֵּלִים עוֹלִין לְמִנְיַן הַשְּׁנֵים עָשָׂר"
  - KhM 3:4
  - Arakhin 2:3, 2:5–6
- **App now:** `src/sim/choreo/g3/song.js:28` LEVITES has 12 figures, every one holding an instrument (1 cymbal,
  2 nevel, 9 kinnor). They are both the twelve singers and the whole orchestra. The audio
  (`docs/decisions/audio.md:35`) already treats voices and strings as separate layers.
- **Kind and cost:** possible error / richer action. M–L: about 12 more figures on the duchan, which matters for the
  people budget on `low`. A cheaper option: show the twelve as singers with a few of the kinnorot held by others, and
  say so in the description.
- **Confidence:** medium. The Rambam is explicit; the Mishnah alone is silent on whether the twelve play.

## 12. Possible error: no ma'amad at the afternoon tamid on Friday and on Shabbat
- **Source:**
  - On Friday at minchah the ma'amad did not gather, out of honour for Shabbat.
  - On any day with a musaf there was no ma'amad at the second prayer or at minchah.
  - The Rambam says the Jerusalem members enter the Mikdash with the mishmar, and defines "ma'amad" as their gathering
    for each prayer.
- **Citations:**
  - Taanit 4:3 "עֶרֶב שַׁבָּת בַּמִּנְחָה לֹא הָיוּ נִכְנָסִין, מִפְּנֵי כְבוֹד הַשַּׁבָּת"
  - Rambam KhM 6:4 "וְלֹא הָיוּ מִתְקַבְּצִין לִתְפִלַּת מִנְחָה בְּעֶרֶב שַׁבָּת מִפְּנֵי שֶׁהֵן טְרוּדִין לְשַׁבָּת"
  - KhM 6:8 "וְכָל יוֹם שֶׁיֵּשׁ בּוֹ קָרְבַּן מוּסָף לֹא הָיָה בּוֹ מַעֲמָד לֹא בִּתְפִלָּה שְׁנִיָּה שֶׁלָּהֶם וְלֹא בַּמִּנְחָה"
  - KhM 6:2, 6:5
  - Taanit 4:4
- **App now:** `maamad-afternoon` (`src/data/schedule.js`) has `dayTypes` weekday, friday and shabbat.
- **Fix:** drop Friday and Shabbat from `maamad-afternoon`, or keep it and say why in its description. Cost S.
- **Confidence:** medium-low. These rules may govern only the ma'amad's prayer gatherings, and Taanit 27b puts those
  "לְבֵית הַכְּנֶסֶת". People could still stand at the offering. A decision the orchestrator should make knowingly.

## 13. A donor's leaf hung on the golden vine
- **Source:** whoever vowed a leaf, a grape or a cluster of gold brought it and hung it on the vine over the Heichal
  entrance. Once 300 kohanim were counted for it.
- **Citations:** Middot 3:8 "כָּל מִי שֶׁהוּא מִתְנַדֵּב עָלֶה, אוֹ גַרְגִּיר, אוֹ אֶשְׁכּוֹל, מֵבִיא וְתוֹלֶה בָהּ".
- **App now:** the object `heichal.ulam.vine` has the text, but there is no act (grepped "leaf", "cluster", "vine" in
  the choreography).
- **Staging:** a donor hands a gold leaf to a kohen at the Ulam steps, and the kohen climbs and hangs it. Only a kohen
  enters the Ulam; how it was hung is reconstruction.
- **Kind and cost:** small occasional event. M (needs a ladder and reach).
- **Confidence:** medium. The text does not say how often.

## 14. Ben Achiyah, physician of the kohanim
- **Source:** the kohanim stand barefoot on the stone floor, eat much meat and serve in a single tunic, so they suffer
  in their bowels. An officer is appointed to visit them and heal all their ailments, and he and his men attend them
  constantly. He is one of the two officers the public itself accepted.
- **Citations:**
  - Shekalim 5:1 "בֶּן אֲחִיָּה עַל חוֹלֵי מֵעַיִם"
  - Shekalim 5:2 "חוּץ מִבֶּן אֲחִיָּה … שֶׁאוֹתָן קִבְּלוּ רוֹב הַצִּבּוּר עֲלֵיהֶן"
  - Rambam KhM 7:14 "לְפִיכָךְ מַעֲמִידִין מְמֻנֶּה אֶחָד שֶׁיִּהְיֶה מְבַקֵּר אוֹתָן וּמְרַפֵּא כָּל תַּחְלוּאֵיהֶן … הוּא וַאֲנָשָׁיו"
- **App now:** nothing found (grepped "bowel", "physician", "doctor", "ben Achiyah").
- **Staging:** a figure in his own clothes attending an off-duty kohen. The place is unknown; Beit HaMoked's chol half
  is a modest choice. Also add a glossary and describer line.
- **Kind and cost:** new detail and information text. S–M.

## 15. The ma'amad's reading of Ma'aseh Bereishit
- **Source:** the men of the ma'amad read the account of Creation by the day of the week: Sunday "Bereishit" and
  "Yehi rakia", … Friday "Totzei ha'aretz" and "Vayechulu". A long section is read by two, a short one by one.
  - They read from a scroll at shacharit and at the added prayer.
  - At minchah they recite it by heart, like the Shema.
  - Those near Jerusalem enter the Mikdash with the mishmar.
- **Citations:**
  - Taanit 4:2–3 "וְקוֹרִין בְּמַעֲשֵׂה בְרֵאשִׁית … בַּמִּנְחָה נִכְנָסִין וְקוֹרִין עַל פִּיהֶן"
  - Rambam KhM 6:2 "מִי שֶׁהָיָה מֵהֶן בִּירוּשָׁלַיִם … נִכְנָסִין לַמִּקְדָּשׁ"
  - KhM 6:4 "וְקוֹרִין בְּסֵפֶר תּוֹרָה שְׁלֹשָׁה אֲנָשִׁים"
  - KhM 6:6–7
- **App now:**
  - `maamad-morning` and `maamad-afternoon` show only standing in `ezrat-yisrael`.
  - The description mentions reading "in their towns" only.
  - A `scroll` prop exists.
- **Kind and cost:** new watchable event. M.
- **Confidence:** low-medium. No text places the Jerusalem group's reading inside the precinct. Taanit 27b
  "מִתְכַּנְּסִין לְבֵית הַכְּנֶסֶת" suggests a synagogue.

---

## Checked and already present (not gaps)
- The chazzanim and garment niches (Tamid 5:3).
- The psachter on Shabbat (Tamid 5:5).
- The wood types (Tamid 2:3).
- The 93 vessels and the gold cup (Tamid 3:4).
- The nanasin and the marble tables (Tamid 3:5; Shekalim 6:4).
- The marble and gold tables in the Ulam (Menachot 11:7).
- Bilgah's ring and window (Sukkah 5:8).
- The 21 and 27 blasts (Sukkah 5:5).
- Arakhin 2's instrument counts and the boys.
- The four seals and the evening reckoning (Shekalim 5:3–5).
- The thirteen shofarot with their labels (Shekalim 6:5).
- The Chasha'im chamber (Shekalim 5:6).
- The kinnin chest (Shekalim 6:5; Eruvin 32a).
- The wood chamber's blemished kohanim (Middot 2:5).
- The Gazit lineage court in black and white (Middot 5:4).
- The Golah wheel (Middot 5:4; Eruvin 10:14).
- The mikveh under the Birah and the privy of honour (Tamid 1:1).
- The KG's chavitin, half morning and half afternoon (Menachot 4:5).
- The Shabbat musaf, bazichin and showbread division.
- The outgoing mishmar's blessing (Tamid 5:1).
- The afternoon lottery (Yoma 26a).
- The Pesachim 5:1 hours.
- Bikkurim as a seasonal lane (Bikkurim 1:6, 3:4).
- The metzora, yoledet and zav at Nikanor (Negaim 14; Sotah 1:5).

**Also checked:** the thirteen prostrations.
- The app follows Middot 2:3 (Mount, opposite the soreg breaches) and mentions Shekalim 6:3.
- Middot 2:6 (Abba Yosi ben Chanan) instead puts them in the Azarah opposite thirteen gates. Bartenura ties that view
  to the count of thirteen gates and the seven-gate view to the breaches.
- This is a choice between authorities, not a gap.

**Considered and dropped as too thin:** the Rambam's ruling that terumat hadeshen is done in lesser garments
(TuM 2:10). Its visual payoff before dawn is small.

## For the Rosh Chodesh agent (outside this pass)
Rambam TuM 6:3 places the Rosh Chodesh musaf limbs on the altar itself: "נוֹתְנִין עַל הַמִּזְבֵּחַ מִלְּמַעְלָה בֵּין
קֶרֶן לְקֶרֶן בִּמְקוֹם הִלּוּךְ רַגְלֵי הַכֹּהֲנִים כְּדֵי לְפַרְסְמוֹ". Shekalim 8:8 says "under the karkov", which
Bartenura reads as on the sovev.

## Cheapest next special days
1. **Korban ha'etzim:** nine fixed dates, e.g. 15 Av, when named families bring wood for the altar and offer olot
   nedavah. That day had no ma'amad at ne'ilah (Taanit 4:4–5; Rambam KhM 6:8–9 "וְהָיָה לָהֶם כְּמוֹ יוֹם טוֹב"). The
   wood chamber, wood logs and kayitz-hamizbeach olot already exist.
2. **The opening of Lishkat HaKelim** by the gizbarim once every thirty days: useful vessels kept, the rest sold
   (Shekalim 5:6 "וְאַחַת לִשְׁלשִׁים יוֹם, גִּזְבָּרִין פּוֹתְחִין אוֹתָהּ").
3. **The summer bikkurim procession:** the ox with gilded horns and an olive crown, the flute playing up to Har HaBayit,
   the Levites' "Aromimcha" (Bikkurim 3:3–4). The lane and the song exist already; it needs the procession and a
   season switch.

# Decisions you may want to revisit

A digest of the non-obvious choices made while building Mikdash, for a later revision. It is drawn from the task logs in
[docs/decisions/](decisions/README.md), [report-errata.md](report-errata.md), [site-model.md](site-model.md) (§4, §7,
§8), ARCHITECTURE.md, CLAUDE.md, README.md and the orchestrator's own choices. The logs hold the full reasoning and the
measurements; this file says what was chosen, why, what else could have been chosen, and where to change it.

**Confidence**
- *sourced reading*: a source states it, or the model follows one stated reading where the authorities differ.
- *reconstruction*: the sources do not fix it; the choice is ours, kept modest and logged.
- *engineering*: a technical, product or scope choice, not a claim about the Mikdash.

**After a change**: in `src/data/site.js` run `runChecks()` (README, site-model.md); in `src/data/schedule.js` or
`offerings.js` run `node tools/validate-schedule.mjs` and `node tools/coverage.mjs`; for walkable geometry run
`node tools/nav-coverage.mjs`. If you change a reading that the About panel lists ("Where the sources differ",
`src/ui/aboutpanel.js` `CHOICES`), change that text too.

Entry ids (A1, B3 …) are used for cross-references.

---

## Top decisions

The thirteen choices with the largest effect on accuracy, on what a visitor sees, and on how the visit works.

1. **The amah is 48 cm (R' Avraham Chaim Naeh).** Every dimension of the sanctuary scales with it; the landscape stays
   in real metres (B1). *Alt:* R' Moshe Feinstein ≈ 54 cm or the Chazon Ish ≈ 57.6 cm, both selectable (Settings,
   `?amah=feinstein|chazonish`). *sourced reading.* *Change the default:* `src/core/units.js` (`AMAH_STANDARDS`; the
   fallback `return 'naeh'`).
2. **The visitor arrives on Monday 2 November 2026 (22 Cheshvan 5787) at alot − 6 min, 38 amot east of the foot of the
   Chel steps, facing 279°, pitch 10°.** An ordinary weekday (psalm 48, no festival), "slightly before dawn at the outer
   steps", as asked. The spawn was moved east of the steps' foot for framing: from anywhere on that axis the Ezrat
   Nashim east wall hides the Heichal, so the view frames the soreg, the steps, the gate and the glow through it, turned
   9° north so the glow sits left of centre. The Ish Har HaBayit's night round is timed to reach the foot of the steps
   with his torches half a minute after this moment (D14), so a new default time or place loses him from the first view.
   The date also fixes how busy the day is (D1: a busy weekday) and the sky (a half Moon with Jupiter and Mars, F13).
   *Alt:* the foot of the steps (anchor `mount.chel.steps.foot`), another date, time or season. *engineering.*
   *Change:* `src/time/index.js` `DEFAULT_DATE`, `DEFAULT_OFFSET_FROM_ALOT`; `src/world/mount/posts.js`
   `add('start', …)`; `src/sim/choreo/night-watch.js` `DAWN_LEAD`; per link `date=`, `t=`, `at=`, `look=`.
3. **The clock: the Vilna Gaon's seasonal hours (sunrise to sunset = 12 hours), alot at the sun 16.1° below the
   horizon, tzeit at 8.5°, sea-level sunrise and sunset, Israel Standard Time (UTC+2) all year with no DST.** Every
   event's clock time follows from these. The angles are the standard Jerusalem calendars' conventions (16.1° ≈ 72
   minutes at the equinox), not numbers from the Mishnah. The visible sunrise over Har HaMishchah is about 20 minutes
   after the zman sunrise; the sky shows the real one (H4). *Alt:* the Magen Avraham's day (alot to tzeit), a fixed
   72-minute alot, elevation-adjusted sunrise, civil summer time. *sourced reading* (the GRA's hours) / *engineering*
   (the angles, sea level, the time zone). *Change:* `src/time/zmanim.js` (`ZMAN_ANGLES`), `src/time/astro.js` (offset);
   the UI dial follows `ctx.time`.
4. **The sources give the order of the service; nearly all clock minutes are reconstructed.** Anchors in use: the
   knock at alot − 70, Barkai at alot + 5, the gates opened from sunrise − 7, the slaughter from sunrise − 1, the
   afternoon tamid at 8½ seasonal hours (Pesachim 5:1, sourced), its incense and the Menorah at about 9¼ hours,
   individuals' offerings from sunrise + 106 to 8.3 hours, the locking at tzeit − 15. Each event shows a badge (Time
   sourced / Order sourced, minutes reconstructed / Time reconstructed). *reconstruction.* *Change:* `when` and
   `timing` in `src/data/schedule.js`; see C2–C8.
5. **Where the authorities differ, the model shows one reading.** The Heichal is T-shaped (Middot 4:7), not the
   Rambam's 100 × 100 square; its walls are solid with 38 ta'im as cells (Rashi), not the Rambam's hollow walls; two
   curtains an amah apart, not R' Yosi's one; the altar mostly south of the axis (R' Eliezer b. Yaakov), not centred
   (R' Yehudah); the Gazit trio on the north (Yoma 19a, Rambam), not the printed Middot's sides; seven Azarah gates, not
   thirteen; the Chel a terrace ten amot wide climbed by twelve steps, not a chel ten amot high (a reading of the
   Rambam); the Menorah's lamps east–west (Tamid, Raavad), not north–south (Rambam); Ulam steps with amah treads, not
   the Rambam's half-amah; the kalya orev an iron blade (Rambam), not Rashi's spiked plates; 24 rings in six rows of
   four, not four of six; the Friday-night rule (D6). *sourced reading.* *Change:* `src/data/site.js` (and the builders
   that read it), `src/ui/aboutpanel.js` `CHOICES`; variants not built are listed in site-model.md §8.
6. **The eastern walls are low so the Parah kohen sees into the Heichal (B3).** Mount east wall +22, Ezrat Nashim east
   wall +28, Nikanor wall +35½ amot, against +40 / +46 / +56 for the other walls. The test puts the kohen standing on
   the burning pyre (Parah 3:9: he "descended" afterwards), eye at +153; he sees 17.17 of the doorway's 20 amot (17.02
   from the crest's ground). *reconstruction* (that they were low is sourced; the heights and the kohen's stand are
   ours). *Change:* `src/data/site.js` `MOUNT_EAST_WALL_H`, `LINTEL_COURSE` and the court east walls; re-run
   `parahSightLine()`.
7. **Three placements the site model flagged for sign-off.** (a) Lishkat HaGazit straddles the Azarah's west wall at its
   north end, kodesh in its east half and chol in its west (Yoma 25a, Abaye), a reading of lock #7; read literally the
   lock straddles the north wall (B14). (b) The Ulam stair has four rovadin, treads 3/3/3/4 (run 21) and a 1-amah apron,
   where lock #25 lists "3/3/4" and the report says run 22 (B24). (c) The Shushan HaBirah chamber over the east gate
   takes the +25–26 band, the only sight of the doorway the Gemara's level-line model (Yoma 16a) leaves if the court
   walls are high; with the walls as built that model still sees 12 amot, and under the real topography the chamber
   costs nothing (B6). *reconstruction.* *Change:* `src/data/site.js` `GAZIT` (the north-wall straddle is kept as
   `params.variants.nWallStraddle`), `ULAM_TREADS`, `mount.gate.shushan.chamber`.
8. **Where the model departs from the research report.** The report is the authority, but where it contradicts itself
   or its citation the Hebrew decides (report-errata.md, A2). The visible cases: the first lottery is drawn in Beit
   HaMoked, before the wicket into the Azarah is opened (Tamid 1:2–3), not in the Gazit with the other three (§27.2,
   §62); the afternoon incense and Menorah come with the afternoon tamid (≈ 9¼ seasonal hours, C4), not at dusk; the
   Ulam stair runs 21 + an apron, not 22. The builders also departed from the report's own readings in logged places:
   the Ulam's rovadin as ⅓-amah ledges, not 3-amah setbacks (B26); the marble chosen stone by stone after Rashi, not in
   courses (F1); the thirteen chests in Ezrat Nashim, not the Azarah (B20). The app's text never cites the report,
   which is not published (K5). *sourced reading* (the errata) / *reconstruction* (the builders' readings). *Change:*
   report-errata.md and the entries named; for the lottery `src/data/schedule.js` `first-lottery` and
   `src/sim/choreo/g1/`.
9. **Only weekdays, Fridays and Shabbat are simulated.** Pesach, Shavuot, Sukkot (the water libation, Simchat Beit
   HaShoevah on the gezuztra), Rosh HaShanah, Yom Kippur and Rosh Chodesh are not; a festival date shows an ordinary day
   of its weekday. *Alt:* add day types with their musafim and crowds (`ctx.audio.ambience.setPopulation` exists for
   crowds). *engineering* (scope). *Change:* `dayType` in `src/time/`, `dayTypes` in `schedule.js`, new choreographies.
10. **The observer may walk anywhere, including the Azarah, the Heichal and the Kodesh HaKodashim.** Entering rung 7
    or higher from a lower rung shows a notice with the place's access rule and its Mishnah; inside the Heichal and the
    KhK it adds "you see it here as an observer". Shut doors and curtains do not stop him either (door leaves are not
    colliders, I2), and he can climb the cedar posts to the Heichal roof (B31). *Alt:* stop the observer at a chosen
    rung, or fade at the threshold and offer a view from outside. *engineering* (a values choice). *Change:* the
    restricted-place notice in `src/ui/hud.js`, collision rules in `src/player/`.
11. **Everything is procedural: no downloaded textures, models, HDRIs or recordings.** Stone, gold, cloth, people,
    animals, sky and sound are generated in the browser. This keeps the page small, licence-clean and fast. It is why
    the people are stylised rather than photoreal (the faces remain a stylised average after the QA rounds, E1), and
    why the voices and instruments are synthesised. The Levites' melodies are a modal reconstruction either way: they
    are not preserved (G2). *Alt:* licensed scanned figures and recorded instruments (size, licensing and load time).
    *engineering.* *Change:* ARCHITECTURE.md §2 rule.
12. **Only traditional Jewish sources count as evidence (A1).** No Josephus, no Christian or modern reconstruction, no
    modern drawing. It is why the Mount has plain double stoas of the model's own proportions instead of Josephus's
    Royal Stoa, and why no "treasury" is taken from the New Testament. Period archaeology does fill in material culture
    the texts leave open (Herodian ashlar, lamps, pots, coins, keys, the coin-lyres, textile colours, statures),
    labelled reconstruction. *Alt:* admit Josephus or archaeology for the Mount's architecture, or keep archaeology out
    of material culture too.
    *engineering* (project policy). *Change:* ARCHITECTURE.md §0.
13. **How the wonders are shown.** One is shown as fact all the time: the altar's smoke rises straight and nothing in the
    scene bends with the wind (Avot 5:5; Yoma 21a–b), the column about 80 m tall (F10). The altar fire is an ordinary
    wood fire, with no glow or change of colour (Yoma 21b, F9). Helena's nivreshet flashes only as real sun glints (F15).
    The western lamp is relit each day as in the late era, and wonders such as the bread "as warm as when it was set"
    sit in the aggadah layer, which is on by default (C9). *sourced reading* (each) / *engineering* (the policy). *Alt:*
    put the straight smoke in the aggadah layer too (a plume that moves with the wind otherwise), or turn the layer off
    by default. *Change:* `src/render/fx/` (smoke), `src/ui/settings.js` `aggadah`, `schedule.js` `layer`.

Also waiting on you, outside the model: no licence for the project's own work (K1), the personal email in every commit
of a public history (K2), and fonts loaded from Google Fonts (K3).

---

## A. Sources and interpretation

- **A1. Traditional Jewish sources only.** Tanakh, Mishnah, Talmud, the Rambam, the classic commentators and Ezrat
  Kohanim; no Josephus, Christian or modern reconstructions, and no modern drawing as evidence. This is why the stoas
  are not Josephus's Royal Stoa, the "treasury in the Court of the Women" is not used as a source, and Tavnit Heichal's
  Josephus-derived stoa sizes are unused. What the texts leave open in material culture is taken from period
  archaeology and labelled reconstruction: Herodian ashlar and its dressing, knife-pared oil lamps, the Jerusalem
  cooking pot, Tyrian shekels, Roman-period keys, the lyres on Judean coins for the kinnor and nevel, the clavi and
  colours of Judean textile finds, skeletal statures. One slip against the rule: the mourners' black and the white worn
  after mourning cite Josephus (War 2.1.1) beside Bava Metzia 59b and Middot 5:4 (people-4.md); the two Jewish sources
  carry the black by themselves. *engineering* (project policy). *Alt:* admit Josephus or archaeology for the
  architecture; keep archaeology out of material culture too. *Change:* ARCHITECTURE.md §0; the citation is a
  comment in `src/people/roles.js` (the mourners' garb).
- **A2. The research report governs, except where it contradicts itself or its citation; then the Hebrew text
  decides.** Nine such places are in report-errata.md: the first lottery's place, the afternoon incense at "dusk", the
  citation for the unsanctified Nikanor gateway, the Gevini timing, Lishkat HaKelim's guard, the Pesach groups, the dawn
  inspection's route, the Ulam stair's run, and (not the report's) the sample manifest's errors. The visible ones are in
  Top 8. *sourced reading.* *Change:* report-errata.md and the data it points to.
- **A3. The sample manifest, diagrams and video are samples only (the user's instruction).** Coordinates, timings and
  visual design never come from them. The model departs from the sample where the sample is wrong: the altar horns 1 amah
  off, the crown at +115, the inner parochet inside the KhK, holes at the courts' east corners (site-model.md §7).
  Four reconstruction values happen to equal the sample's; each is re-derived (site-model decisions, "Sample
  coincidences"). *engineering.*
- **A4. An element carries the confidence of its weakest defining number.** So many elements whose plan is in Middot
  read `reconstruction` because a height or footprint is ours; `params.fieldConfidence` keeps the sourced parts.
  *Alt:* label by plan only (hides the ⚙ parts). *engineering.* *Change:* `src/data/site.js`, enforced by `runChecks()`.
- **A5. Sanctity is numbered 0–10 on the Rambam's count (BhB 7:12–13): Eretz Yisrael 0, Har HaBayit 3, Heichal 9, KhK
  10.** It is the only 0–10 scale on which the KhK keeps a rung of its own. *Alt:* the report's §0.5 1-based count
  (Har HaBayit 4, Heichal 10); the UI detects either from Har HaBayit's value. *sourced reading.* *Change:*
  `src/data/zones-content.js` `SANCTITY_SCALE` and each zone's `sanctity`.
- **A6. Rungs for places the sources do not rank.** Roofs and upper storeys at 3 (BhB 6:7: not sanctified); the aliyah
  at 9 (BhB 7:23 restricts it); the Chuldah passages and the underground route at 2 (BhB 6:9); a half-kodesh chamber
  takes one number (Gazit 7, Beit HaMoked 4); the Etz/Parhedrin 4 (an inference, labelled); ta'im and mesibah 9; the
  amah traksin 10; Nikanor, the fifteen steps and the music chambers 5; the Azarah gate zones, outer stairs included, 7;
  the Kidron, Har HaMishchah and the causeway 0, the city 2. *reconstruction.* *Change:* `zones-content.js`.
- **A7. Derived facts are shown as derived.** Beit Avtinas over the Water Gate (south) follows from lock #20's
  Parhedrin in the north; Yoma 19a itself leans the other way (Rav Pappa). The uses of Sha'ar HaDelek, HaBechorot and
  HaKorban are readings of their names. Lishkat HaKorban and HaParochet are "named only as night posts". *sourced
  reading.* *Change:* `zones-content.js`, `schedule.js` descriptions.
- **A8. Divine Names are written in their customary substitutes (ה׳, אֱלֹקִים, קֵל) and sung as Hashem, Elokim, Kel;
  the tzitz reads "קדש לה׳".** Elohim used of judges or other gods is left as written (Ps 82, Devarim 32). *engineering*
  (respect). *Change:* `src/audio/dev/make-songs.mjs` (regenerates `songs-text.js`), the tzitz canvas in `src/people/`.
- **A9. English renderings are the project's own, close to the Hebrew,** not a published translation (the user asked
  for this; JPS is copyrighted). Hebrew of the songs is the Leningrad Codex, with four words of Ha'azinu in the Sefer
  Torah's spelling. *engineering.* *Change:* `src/audio/songs-text.js` via `make-songs.mjs`.

## B. Site model and architecture

- **B1. The landscape is in metres, the sanctuary in amot.** The Kidron, Har HaMishchah, wall feet and the Chuldah
  portals are metre profiles converted with the page's amah, so the terrain stays real under every standard. *Alt:*
  freeze the context at 48 cm (misplaces the terrain under the larger amot). *engineering.* *Change:* `src/data/site.js`
  context section.
- **B2. Terrain is approximate real topography, not a DEM:** wall foot 712 m on the east, Kidron bed ≈ 675 m (taken
  ≈ 10 m below today's fill), crest 808 m on the axis, platform 740 m; generic Judean ridges beyond 1.4 km.
  *reconstruction* (no downloaded data allowed). *Change:* terrain profiles in `site.js`, `src/world/terrain/`.
- **B3. Low eastern walls for the Parah sight line.** Middot 2:4 has the kohen on Har HaMishchah see the Heichal's
  doorway. With the real topography a 40-amah Ezrat Nashim east wall blocks every line; the undiminished view needs it
  ≤ +37½ (site-model.md §4). So every eastern wall on the axis is "the eastern wall" and kept at gate head + a 2-amah
  lintel course. The line is tested from the kohen standing on the arrangement (Parah 3:9: the heifer is laid on it, he
  sprinkles, then "descends"), 1 amah in from its east edge, eye +153; the pyre's 8-amah height is ours. *Alt:* only
  the wall over Shushan low (Rambam BhB 6:5), which suits the Gemara's level-line model but blocks the real line; the
  kohen on the ground beside the pyre (the pyre then stands in his way). *reconstruction.* *Change:*
  `MOUNT_EAST_WALL_H`, `LINTEL_COURSE` and the court east walls in `site.js`; re-run the sight-line test.
- **B4. Other court walls are the court floor + 40** (Ezrat Nashim 46, Azarah 56). *Alt:* 40 above the Mount datum.
  *reconstruction.* *Change:* `site.js`.
- **B5. Stoas: double, 20 amot deep (two aisles), roof at +20, columns every ~10, plain monolithic marble columns with
  Doric-type capitals, no fluting or foliage; raised bays over the gate passages.** "Stav lifnim mistav" gives no
  numbers; a roof under the low east wall keeps the Parah line clear. *Alt:* Tavnit Heichal's 30/45-amah stoas,
  Corinthian capitals (Josephus-derived). *reconstruction.* *Change:* `STOA_ROOF` in `site.js`, `src/world/mount/`.
- **B6. A chamber of Shushan HaBirah over the east gate (+22 to +28) holds the two standard amot at its NE and SE
  corners (Kelim 17:9); the image of Shushan is a white-marble low relief of a walled city with towers and a palace, no
  figures and no merlons.** Merlons would be the only battlement-like silhouette on the Temple's most-viewed facade
  (report §25). *Alt:* no chamber (keeps the Gemara's level-line band +25–26 clear); a crenellated image.
  *reconstruction* (the form). *Change:* `site.js`, `src/world/mount/gates.js`.
- **B7. The Chuldah gates open at the Ophel grade (−27 amot at 48 cm), with level passages north and stairs up to the
  Mount.** "The tunnels exit south"; the real drop is ≈ 13 m. *Alt:* gates at the Mount's level with no tunnel.
  *reconstruction.* *Change:* `site.js` (`context.chuldah.*`), `src/world/mount/`.
- **B8. The soreg runs 10 amot outside the whole complex, jogging round the Gazit's chol half and Beit HaMoked; its 13
  repaired breaches are spread 4 N, 4 S, 3 E, 2 W.** The side counts are borrowed from Shekalim 6:3's "opposite the
  thirteen gates" (labelled so). *Alt:* a plain rectangle; an even spread with no side counts; stations at the gates.
  *reconstruction.* *Change:* `site.js` `mount.soreg`.
- **B9. The twelve Chel steps fill the inner 6 amot of the east chel against the Ezrat Nashim gate, 20 amot wide.**
  Rambam BhB 6:1: walk level to the end of the chel, then climb. *Alt:* across the full chel width or the whole Ezrat
  Nashim front. *reconstruction.* *Change:* `site.js` `mount.chel.steps`.
- **B10. Flights of 32 half-steps run from every north and south court door down to the Mount, and barrel vaults carry
  them over the chel walkway (springing +4, crown +7.75).** The +16 court over a Mount at 0 forces the flights; EK
  (I 202–215) notes they cross the chel. Without vaults the chel between two flights was a closed pocket. Vaulting is
  the precinct's attested construction (Parah 3:3 "hollow beneath"; 3:6 "arches upon arches"). *Alt:* flights parallel
  to the walls; a raised chel; open-sided flights (the chel cut at each one). *reconstruction.* *Change:* `site.js`
  `params.underpass` (the `UP` constants), `src/world/courts/`.
- **B11. Ezrat Nashim:** corner chambers of 40 × 40 inside plus 2-amah walls, 22 high and unroofed; the gezuztra as
  timber balconies (the Raavad reads it as wooden) at +16, 4 deep, on three sides, reached by four timber stairs; the
  fifteen steps as half-annuli, landing radius 10½ and foot 17½; the music chambers flanking the stair under Ezrat
  Yisrael. *Alt:* stone balconies; a continuous gallery ring; a larger semicircle (leaves no wall for the music-chamber
  doors). *reconstruction.* *Change:* `site.js` `en.*`, `src/world/courts/en.js`.
- **B12. Nikanor's wickets (3 × 8, 7–10 amot off the axis) are the doors of Lishkat Pinchas HaMalbish (north) and Osei
  Chavitin (south), chambers built in the wall** (EK / Chanukat HaBayit). Nikanor's bronze leaves open to 72° so their
  faces show from the steps. *Alt:* free-standing wickets; leaves folded flat. *reconstruction.* *Change:* `site.js`,
  `src/world/courts/`.
- **B13. The Azarah's six chambers, Gazit included.** The Gazit (B14) and its neighbours on the north; Melach, Parvah
  and Medichin on the south between the gates; the Etz/Parhedrin inside the court against the north wall, opening only
  north to the chel, so its inside is chol (Rambam BhB 6:7; Yoma 10a's mezuzah). *Alt:* the printed Middot's sides;
  Parhedrin in the south (Yoma 19a) or by Nikanor (the Raavad). *sourced reading* (sides) / *reconstruction*
  (footprints). *Change:* `site.js` `azarah.chamber.*`.
- **B14. The Gazit: 45 × 20, straddling the west wall at its north end, kodesh in its east half and chol in its west.**
  Yoma 25a (Abaye): the lottery in its east in kodesh, the elder in its west in chol, so the dividing line runs
  north–south; on the Azarah's outline only the west wall gives that, and its north end is "in the north". Built as a
  basilica (marble columns in the kodesh nave, cedar beams over the chol hall), the Sanhedrin on four stepped
  semicircular tiers (about 85 places: one row of 71 cannot fit; Sanhedrin 4:3). *Alt:* straddling the north wall (lock
  #7 read literally: halves north/south, the lottery in the south); EK's east-wall Gazit; wholly inside. *reconstruction.*
  *Change:* `site.js` `GAZIT`, `src/world/courts/chambers.js`.
- **B15. Chamber doors are 16 amot high, not Middot 2:3's 20.** The 20-amah rule is read as covering gates only
  (Zevachim 55b: "pishpeshin are different"); 20-amah doors would rise through the chambers' 20-amah roofs, which Middot
  5:4 and the En Eitam head (Yoma 31a) keep low. *Alt:* raise the six chambers' roofs. *reconstruction.* *Change:*
  `CHAMBER_DOOR_H` in `site.js`.
- **B16. Beit HaMoked: 24 × 24, entering the court only through the 8-amah strip north of the nanasin; kodesh/chol at
  half and half; a dome with an oculus; corner chambers 5 × 6; R' Yehudah's pishpash a wicket in the gate's east leaf;
  the keys slab in the chol half (someone slept on it, Middot 1:9); eight keys, one per Azarah gate and one for the
  wicket.** *Alt:* centred on the wall line (eats the explicit 8 amot of Middot 5:2); wholly outside (the Rambam's all-chol
  camp); thirteen keys. *reconstruction.* *Change:* `site.js` `azarah.moked.*`, `src/world/courts/moked.js`.
- **B17. The underground route: a winding stair of 56 half-steps from the Moked's NW chamber down to −12, a vaulted
  passage north and the Beit HaTevilah (mikveh, fire, privy).** Lock #21 puts it under the Birah, whose site is open.
  *Alt:* R' Eliezer b. Yaakov's route under the chel to Tadi. *reconstruction.* *Change:* `site.js`.
- **B18. The Water Gate's roof is an open terrace carrying Beit Avtinas and the Kohen Gadol's first mikveh (water at
  +39 = the En Eitam head); the tank is narrowed to 3½ × 2½ so a walk reaches Beit Avtinas.** Tamid 1:1, Yoma 31a.
  *Alt:* the wall continuing to +56 with the rooms inside it. *reconstruction.* *Change:* `site.js`
  `azarah.gate.mayim.house`.
- **B19. Chambers placed by inference.** Lishkat HaKorban and HaParochet on the Mount outside the soreg (Levite posts;
  women wove the curtains, Ketubot 106a); Beit HaEven north-east of the courts, facing the Birah (Parah 3:1); Lishkat
  Chasha'im in Ezrat Nashim's north wall (open to men and women); Lishkat HaKelim at the court's NE corner near the
  Moked (Tamid 3:3–4). *Alt:* inside the Azarah (closed to women and most of the poor). *reconstruction.* *Change:*
  `site.js`.
- **B20. The thirteen shofarot stand in a ring in Ezrat Nashim, in the Mishnah's order.** The kinnin chest must be
  where a yoledet can reach it (Eruvin 32a; Kelim 1:8 bars her from Ezrat Yisrael); Shekalim 7:1–2 puts certain chests
  side by side, which a ring gives and a row does not. The site model and the zone texts had first left the chests out
  (the "treasury in the Court of the Women" comes from Josephus and the New Testament); world-4 added them, and the
  Ezrat Nashim info text now names them (Shekalim 6:1, 6:5–6; the ring's placement is the model's). *Alt:* none (A1); a row; in the Azarah (out of the yoledet's reach).
  *reconstruction.* *Change:* `src/world/courts/en.js` `shofarot`, `zones-content.js`.
- **B21. The Mizbeach.** The yesod full on the north and west with a 1-amah stub beyond each corner on the south and
  east, none at the SE (Middot 3:1, Rav); the top at 9 whole amot (+25), not the Rambam's 58 tefachim; the kevesh
  centred on the south face, 30 on the ground and flying 1 + 1; the small ramps at the 1:3 slope of Zevachim 63a; the
  karkov read as two (RNbY, Zevachim 62a: the walkway for the kohanim's feet and an ornamental band under the sovev);
  hollow horns; a hair's-breadth gap before the altar. *Alt:* the corner squares alone as the yesod's "1 amah"; a single
  karkov. *sourced reading* / *reconstruction* (forms). *Change:* `site.js` `altar.*`, `src/world/altar/`.
- **B22. The slaughter ground follows the Rambam's chain (wall 8 · 12½ · tables 8 · rings 24 · 8), with 24 rings in six
  rows of four across the altar's 32-amah width; one row of eight marble tables in the Rambam's band and the flaying
  stations between the dwarf pillars (3 + a 1-amah cedar block, so the lamb's hook is within a standing man's
  reach).** *Alt:* Middot 5:2's chain; Middot 3:5's "tables between the pillars"; 5-amah pillars. *sourced reading* /
  *reconstruction* (heights). *Change:* `site.js` `altar.rings`, `altar.marble-tables`, `altar.nanasin`.
- **B23. The kiyor (4 × 3 amot) stands just south of the Ulam steps inside the altar's north–south span, with a
  trestle-and-windlass muchni south of it and a well whose water stands at +14½, so the laver sunk at night is under
  water.** Middot 3:6; Yoma 37a. *reconstruction* (place, size, machine). *Change:* `site.js` `altar.kiyor`,
  `src/world/altar/kiyor.js`.
- **B24. The Ulam steps: twelve half-amah rises with treads in groups amah, amah, rovad of 3, three times, then amah,
  amah, rovad of 4 (run 21), plus a 1-amah level apron at the foot.** Yoma 4:3 needs a fourth rovad; lock #25 lists
  "3/3/4"; the report's "run 22" only works with R' Yehudah's top rovad of 5 (erratum #8). *Alt:* R' Yehudah's top 5
  (run 22, no apron); the Rambam's half-amah treads (BhB 6:4). *reconstruction.* *Change:* `site.js` `ULAM_TREADS`,
  the apron.
- **B25. The ta'im are three storeys of 11 amot with roofs at +55, so the high Kodesh windows open above them, and a
  24-step flight on the south roof climbs to the aliyah door at +67.** Report Part VII §22 has the windows above the
  ta'im roofline; Middot 4:5 gives the route but never says it is level. *Alt:* roofs at +67 for a level walk (the
  windows would then open into the ta'im or the aliyah). *reconstruction.* *Change:* `site.js` `heichal.taim.*`.
- **B26. The Ulam's rovadin are banded ledges ⅓ amah deep, not 3-amah setbacks.** The Rambam's "רחב" is read as the
  band's height; 3-amah setbacks every 4 amot would make a stepped pyramid. This departs from the report's Part V §13.4
  and VII §25. *Alt:* flush courses; deep ledges. *reconstruction.* *Change:* `src/world/heichal/`.
- **B27. The Ulam block is bare polychrome marble (Bava Batra 4a), the body behind it whitewashed (Middot 3:4).**
  *Alt:* all bare or all washed. *reconstruction.* *Change:* `src/world/heichal/` materials.
- **B28. Inside the Heichal: a gold lining with six registers of relief (open flowers, palms, keruvim), a coffered gold
  ceiling, gold floors; the keruvim as children with bird wings rising from the shoulders, in pairs facing each palm.**
  Yoma 54a, 1 Melachim 6:29, Sukkah 5b, Shemot 25:20. No Ezekiel two-faced figures, no halo, no robe. *reconstruction*
  (drawing and arrangement). *Change:* `src/world/heichal/kodesh.js`, `src/world/materials/` (`gold_relief`).
- **B29. Vessels and curtains.** The Menorah by the tefach ladder (Menachot 28b) with straight branches (lock #30), its
  seven lamps evenly over the site's 2 amot; the ner ma'aravi is the second lamp from the east (Tamid 6:1 with the
  east–west row); both parochot inside the amah traksin, a tefach each, 4 tefachim apart, the outer pinned back at the
  south and the inner at the north (lock #42; Yoma 52b); the Shulchan 10 × 5 tefachim (R' Yehudah), its loaves "breached
  boxes" with 7-etzba horns. Of the thirteen parochot (Yoma 54a), seven hang one at each Azarah gate on its court face,
  gathered at the jambs; the hanging is ours. *Alt:* the Rambam's middle lamp (north–south row); SG's clear amah between
  the curtains; the 6-tefach amah for the Shulchan. *sourced reading* / *reconstruction* (thickness, spacing,
  hanging). *Change:* `site.js` `heichal.menorah.params.nerMaaravi`, `heichal.parochet.*`;
  `src/world/heichal/vessels.js`; the gate curtains in `src/world/courts/`.
- **B30. The Ulam's chains hang to 4 amot above the floor (+26) so the young kohanim can climb them (Middot 3:8).**
  *Alt:* to +48 with a ladder (no source). *reconstruction.* *Change:* `site.js` chain `bottomZ`.
- **B31. The Heichal roof (+112) is reached only by climbing the two cedar posts at the aliyah door** (Middot 4:5;
  R' Shimshon's rungs); the nav has climb links, not a stair. The posts stop at +112 and the ma'akeh and the kalya orev
  run unbroken round the roof, so the climb crosses over them at +116, over the iron blade. *Alt:* a stair through the
  aliyah (no source); a gap in the ma'akeh above the posts (the climb would step through at +112 with no player change).
  *sourced reading* (the posts) / *reconstruction* (the crossing). *Change:* `src/player/` climb links, `site.js`
  `heichal.aliyah.door` posts (`postsTopZ`), the ma'akeh in `src/world/heichal/`.
- **B32. Restraint in ornament.** No battlements, merlons, arrow loops or blind arcades; plain cavetto cornices and
  copings; marble door-cases; no Yachin and Boaz; Nikanor's Corinthian bronze unplated (Yoma 38a). Report Part VII §25.
  *reconstruction.* *Change:* the builders in `src/world/`.
- **B33. Approaches.** The Kiponus gate's approach is a level single-arcade bridge across the Tyropoeon (unsourced; a
  stair into the valley would be a second invention); the Parah causeway is "arches upon arches", arch over pier
  (Parah 3:6); Tadi has a short flight. *reconstruction.* *Change:* `site.js` `context.*`, `src/world/mount/`.
- **B34. The city and the land.** Districts west, north-west and south, nothing east (gardens and the olive slope); a
  30 m clear belt round the Mount (Herod's esplanade beyond the halachic 500 is not modelled); courtyard houses with
  earth roofs and parapets of 10 tefachim, a value step darker than the Temple's marble; smoke from cooking fires in six
  courts, mornings and evenings, none on Shabbat (Shemot 35:3); olive terraces on Har HaMishchah; garden plots in the
  Kidron. The `outside` zone text still calls the city "only massing". *reconstruction.* *Change:*
  `src/world/terrain/` (`city.js`, `trees.js`).
- **B35. The night watch's 24 posts at the named places; Levite posts carry torches on iron brackets, the kohanic posts
  (Beit Avtinas, Beit HaNitzotz, the Moked) lamps.** Middot 1:1; Rambam BhB 8:4–9. *Alt:* SG's ten men per post.
  *reconstruction* (spots, fittings). *Change:* `site.js` `mount.watch-posts`.
- **B36. Bilgah's fixed ring is ring 15 of the list (index 14) and his sealed knife niche the third of the south wing.**
  Which ring and niche were his is not recorded. *reconstruction.* *Change:* `site.js` `altar.rings.params.bilgah`.
- **B37. Seven lamps light the dawn inspection's route on Shabbat nights (Rambam BhB 8:12), and lamps in Lishkat
  HaKelim and the lamb chamber apply the same principle to the vessels and the lamb.** The second part is by analogy.
  *reconstruction.* *Change:* `src/world/courts/` (`courts.azarah.lamp-*`, `courts.kelim.*`).

## C. The daily schedule and timing

- **C1. The order is Mishnah Tamid 1–7, with Abaye's seder (Yoma 33a) for what Tamid leaves implicit** (five lamps
  before the tamid's blood, two after; limbs, minchah, chavitin, libations, musafim, bazichin). *sourced reading.*
  *Change:* `schedule.js`.
- **C2. The pre-dawn chain hangs on alot: the officer's knock at alot − 70.** Tamid 1:2 gives only "cockcrow, or near
  it"; 70 minutes lets the night's work end just before dawn. *Alt:* a fixed night hour (drifts against dawn through the
  year). *reconstruction.* *Change:* `schedule.js` (the pre-dawn events).
- **C3. Barkai at alot + 5, after the second lottery; the gates opened from sunrise − 7; the slaughter from sunrise −
  1.** This follows the report's clock; Yoma 28b would put "the whole east lit" later. *Alt:* Barkai later; the gates
  right after Barkai. *reconstruction.*
- **C4. The afternoon incense and the Menorah at about 9¼ seasonal hours, between the afternoon blood and the limbs.**
  Yoma 14b–15a and Pesachim 5:1; the report's "dusk" would leave two hours between the tamid and its incense (erratum
  #2). *sourced reading* (order) / *reconstruction* (minutes).
- **C5. Individuals' offerings run from the end of the morning song (sunrise + 106) to 8.3 seasonal hours, blood by
  8.35, fats and flaying by 8.4.** Nothing before the morning tamid (Pesachim 58b) or slaughtered after the afternoon
  one (Pesachim 59a). *Alt:* start right after the tamid's limbs (sunrise + 88), during the song. *sourced reading*
  (bounds) / *reconstruction* (minutes). *Change:* `src/data/offerings.js` `offeringWindows`.
- **C6. The locking from tzeit − 15; the watch posted at tzeit; the Ish Har HaBayit's rounds from tzeit + 30 until
  dawn; the Ezrat Nashim east gate is not locked.** No source gives the hour; no source puts that gate in the locking,
  and the Nikanor post must be reachable. *reconstruction.* *Change:* `schedule.js` `locking-up`,
  `src/sim/choreo/night-watch.js`.
- **C7. Occasional scenes get one fixed slot** (the sleeping guard at night hour 7½, a kohen's night descent at night
  hour 6, the metzora at day hour 3, nazirites and hides through the day), each marked as not nightly or daily;
  Beit Avtinas's compounding is "occasional" and never on the clock (only the yearly quantity is given). *Alt:* omit
  them, or random days. *reconstruction.* *Change:* `schedule.js`.
- **C8. Something must always be watchable: no gap over 10 minutes on any day type, and an active event in the Azarah
  from sunrise to sunset.** This is the user's requirement. It is why some reconstructed events exist: the Shabbat-day
  tending of the pile, the Kohen Gadol's showbread meal through the late morning, the night turning of the limbs.
  Intermittent events count as "low" and cannot carry the court alone. *engineering.* *Change:* `tools/coverage.mjs`
  (`--max`, the LOW list).
- **C9. The western lamp is relit per Tamid 6:1 (the late era), not Shimon HaTzaddik's always-burning lamp; wonders
  such as "the bread as warm as when it was set" sit in an aggadah layer** (Settings, on by default; the bread shows a
  faint wisp, no glow). *sourced reading* (the era) / *engineering* (the default).
  *Change:* `schedule.js` `layer`.
- **C10. Shabbat variants are separate events** (inspection by lamplight, psalm 92, musaf and Ha'azinu, the showbread,
  the court in the Chel, the incoming watch's lottery, the Shirah), so each is a clickable item. *engineering.*
- **C11. The afternoon crew: on weekdays the morning's winners; on Shabbat the incoming mishmar by a new lottery (Yoma
  26a).** The bazichin are burned after the musafim by two of the incoming (Abaye; a braita puts them first).
  *sourced reading.*
- **C12. Places the sources leave open:** Gevini calls from the head of the fifteen steps at the knock (Rav reads
  "keriat hagever" as his cry); the morning immersions are in the underground Beit HaTevilah; the Barkai watcher stands
  on the Water Gate's roof walk looking at the eastern sky (Yoma 28b: "on a roof", unnamed; Hebron lies SSW, so "as far
  as Hebron" says how far the light spread, not where to look); the three gate blasts at Nikanor. *reconstruction.*
  *Change:* `schedule.js` `pos` / `view`.
- **C13. Headline sounds and captions come at least half a minute after their event starts**, because "jump to the
  event" lands a quarter minute in and jumps never fire cues. *engineering.* *Change:* `src/sim/lib/cue.js`
  `CUE_LEAD`.

## D. Offerings and daily life

- **D1. The day's offerings are drawn from ranges for an ordinary Cheshvan weekday, with birds the most common,** by
  one seeded quantile per date. On the default date the quantile is 0.96, a busy weekday: about 160 offerings (57
  animals, 70 bird offerings, 28 meal-offerings, 4 bikkurim baskets). No source gives daily counts (Shekalim 5:1, 6:5;
  Keritot 1:7 point to birds). *Alt:* lower ranges; another default date. *reconstruction.* *Change:*
  `src/data/offerings.js` `OFFERING_RULES` (`frequency`; totals include the sets, see CLAUDE.md).
- **D2. The crowd is an ordinary weekday's, never a festival's, and how many you see depends on the graphics tier.**
  The sound's murmur is pitched at about 60 kohanim and Levites before dawn and, once the gates open, about 320 in the
  courts and 110 on the plaza. The figures drawn scale by tier (`DENSITY` low 0.55, medium 0.9, high 1.6, ultra 2.0):
  at the morning peak about 350–370 on high and about 100 on low, the far ones as silhouettes. On low the Sanhedrin
  seats about 36 of its 71 (all 71 on medium and up), and the boy Levites run 2 to 6 by tier (G6). Report §36.5:
  "ma'amad + staff ≈ low hundreds". *Alt:* larger crowds (cost, and they would misrepresent a weekday); the same
  counts on every tier, drawn coarser on low. *reconstruction* / *engineering* (by tier). *Change:*
  `src/audio/ambience.js`, `src/sim/choreo/g4/crowd.js` `DENSITY`, `courts-daily.js`, `sanhedrin.js` `attendance`.
- **D3. Bulls are not staged among private offerings.** The sources do not say how a bull was hung and flayed, and the
  hooks' rows do not lift one clear of the pavement. Species weights: olah lamb .8 / ram .2, chatat a ewe or she-goat,
  an asham brought alone a ram. *Alt:* stage bulls on the floor. *reconstruction.* *Change:*
  `src/sim/choreo/g5/` (species weights).
- **D4. Where an individual's offering is done:** at the eastern rows of rings (the tamid rings kept clear), the
  nearest hook and table; the cooking of most-holy meat in the SE of Ezrat Kohanim with copper vessels; notar burned at
  the ash place east of the ramp, by day only (Rambam Pesulei HaMukdashin 19:4); kayitz hamizbeach olot fill idle lanes.
  *reconstruction* (places) / *sourced reading* (notar by day). *Change:* `offerings.js` `STATIONS`,
  `src/sim/choreo/g5/`.
- **D5. At night the fats burn until midnight and the limbs are turned all night; after midnight one kohen now and then.**
  Rambam MK 4:2–3, TuM 1:6. Who turned them, and how often, is not recorded. *sourced reading* / *reconstruction*
  (staffing). *Change:* `schedule.js` `evening-altar`, `late-turning`, `night-turning`.
- **D6. Friday night: no weekday fats or limbs go on the fire once Shabbat begins, no one tends the pile, and on
  Shabbat morning the leftover limb is moved to the altar's side until Shabbat ends.** Rambam TuM 1:7 as the Kesef
  Mishneh reads it, after Rava (Yoma 46a), with the Ritva for "raised but not put on the fire". *Alt:* Rav Chisda (the
  tamid's end overrides Shabbat); tending through Friday night. *sourced reading.* *Change:* `schedule.js`,
  `src/sim/choreo/terumat-hadeshen.js`, `altar-night.js`.
- **D7. Shabbat: no individuals' offerings (Temurah 2:1), no wood-sorting, hide-salting, nazirite or metzora scenes;
  the Golah wheel runs (Eruvin 10:14); one or two kohanim tend the pile now and then by day.** The daytime tending is
  reconstructed (who did it is not recorded). *sourced reading* / *reconstruction.*
- **D8. No torch is carried on Shabbat nights.** The Rambam (BhB 8:12) says it of the dawn inspection; the lamb's
  inspection, the vessel chamber and the Ish Har HaBayit's patrol follow by analogy. *reconstruction* (by analogy).
  *Change:* `src/sim/choreo/` (g1, g2, night-watch).
- **D9. The Kohen Gadol offers the limbs and pours the wine on Shabbat (Rambam Klei HaMikdash 5:12), not on weekdays;
  he is not shown at the musaf.** *Alt:* "when he wishes" on weekdays too. *sourced reading* / *reconstruction.*
  *Change:* `src/sim/choreo/g2/`, `g6/`.
- **D10. The showbread:** six and six (the anonymous Mishnah; R' Yehudah's seven and five is in the text); the outgoing
  and incoming bread exchanged together (Menachot 11:7); the kanim pulled on Friday; the Kohen Gadol takes half of each
  watch's loaves first, not by division (Yoma 17b; Rambam TuM 4:14, MK 10:18); each kohen's share "a bean's worth"
  (Yoma 39a). That the bringers-in are the incoming watch and the takers-out the outgoing is ours. Which of the 24
  mishmarot is on duty this week is not computed (the rotation's phase is not recorded), so none is named. *sourced
  reading* / *reconstruction* (who carries). *Change:* `src/sim/choreo/g6/bread.js`.
- **D11. Rites by the Rambam where readings differ:** firstling and tithe blood poured against the yesod (MK 5:17), not
  thrown; six carriers for any lamb olah, private ones included (MK 6:10–18); the chatat before the olah (Zevachim 90a);
  women do not lean or wave except the sotah and the nezirah, and the yoledet stands at Nikanor (MK 9:16; Kelim 1:8).
  *sourced reading.* *Change:* `offerings.js` steps.
- **D12. Women:** they walk the circuit on the Mount (only the zavah, niddah and yoledet in her days are barred, Kelim
  1:8); they are not among the bird-offering participants (no leaning, so no reason to enter Ezrat Kohanim); the
  gezuztra stays empty on an ordinary day (it was built for the Water-Drawing). *sourced reading* / *reconstruction*
  (staging). *Change:* `src/sim/choreo/courts-daily.js`.
- **D13. The visitors' circuit goes counter-clockwise, everyone prostrates full length opposite each repaired breach,
  and mourners walk against the stream and are greeted.** Middot 2:2–3; "all your turns to the right". The mourner's
  counter-circuit also runs on Shabbat; the final gate kept it on the strength of Pirkei deRabbi Eliezer 17 and noted it
  for review. *sourced reading* / *reconstruction* (line, spacing). *Alt:* no mourner on Shabbat (public mourning is
  not kept then, Moed Katan 23b–24a). *Change:* `src/sim/choreo/courts-daily.js`.
- **D14. The night watch.** The Levite guards hold no torches; two torch-bearers walk before the Ish Har HaBayit
  ("torches burning before him", Middot 1:2); he is shown as a Levite (the sources do not say); he visits all 21 Levite
  posts, the one behind the Beit HaKaporet through Beit HaMoked and its wicket; he comes and goes by the western Chuldah
  gate; "Shalom alecha" is captioned as his greeting (the Mishnah's plain reading; the Rambam has the guard greet). The
  round's phase is fixed so that he reaches the foot of the Chel steps half a minute after the default opening and climbs
  to Nikanor's post in the visitor's first view (`DAWN_LEAD`); the sources fix no phase ("he went round every post, all
  the night"). *reconstruction* / *sourced reading.* *Change:* `src/sim/choreo/night-watch.js`.
- **D15. Beit HaMoked at night shows six elders, the slab kohen and three young men on mats; five immerse, draw the
  first lottery and walk the inspection.** The floor as built holds only that many sleeping places; the schedule's notes
  give no number. *Alt:* more young men (needs more floor). *reconstruction.* *Change:* `src/sim/choreo/g1/`.
- **D16. Who does what where the Mishnah is silent:** the winner of the clearing works the muchni himself (Tamid 1:4:
  the creak is the first sign of him); the slaughterer also flays and carries the lamb to the hook; eight brothers join
  the clearing; the kiyor sinks at the locking and rises at the muchni. *reconstruction.* *Change:*
  `src/sim/choreo/terumat-hadeshen.js`, `tamid-morning.js`.
- **D17. Bikkurim appear in season only (Shavuot to Chanukah); 22 Cheshvan falls in the season without the
  declaration. The Levites sing Psalm 30; the procession with the ox and flute is left out (it belongs to the main
  season).** *sourced reading.* *Change:* `offerings.js` `offeringWindows(…, { hebrew })`.
- **D18. The Sanhedrin sits in the Gazit's chol half on weekdays and on the Gazit flight's steps in the Chel on
  Shabbat** (Sanhedrin 88b names the Chel, not the spot). *reconstruction* (spot). *Change:* `src/sim/choreo/` (G4).
- **D19. Kohanim in the holy garments never walk on the Mount or in the city.** They come and go through Beit HaMoked
  and Lishkat Pinchas HaMalbish; the agent who brings a metzora's lambs is an Israelite; the firstling's kohen comes in
  his own clothes (Yechezkel 44:19; Rambam Klei HaMikdash 8:11). The sim's test asserts no kohen below the courts' level
  all day. *sourced reading.* *Change:* `src/sim/choreo/` (G4, G5 routes).

## E. People, attire and animals

- **E1. Figures are procedural and stylised:** sculpted heads with modelled eyes close up and painted eyes at mid
  range, LOD silhouettes far off, fabric patterns faded to their average where they would alias. This follows from
  Top 11. *engineering.* *Change:* `src/people/`.
- **E2. Kohanim wear exactly the four white linen garments, barefoot; the ketonet in a boxed weave, sleeves to the
  wrist; the migba'at a dome "like a hat"; the avnet 3 etzba'ot wide, wound over the heart, its wool embroidery design
  ours; the avnet is worn only in the avodah** (Rambam Klei HaMikdash 8:11: it is sha'atnez). The michnasayim are drawn
  only where they show (Tamid 5:3's stripped losers). The avnet comes off for the kohanim's meal, the scouring, the
  showbread's division and eating; it stays on between parts of one service and, undecided, for preparation work
  (compounding the incense, salting the hides, baking the chavitin and the showbread). *Alt:* the Raavad (avnet worn all
  day); an all-linen avnet for the hedyot; the avnet off for preparation work too. *sourced reading* / *reconstruction*
  (embroidery; the preparation work). *Change:* `src/people/` (`setGarb({ avnet })` is driven by
  the sim).
- **E3. The Kohen Gadol:** the me'il all techelet with 72 bells and 72 pomegranates (not 36); the ephod as an apron
  behind to the heels (Rashi); its threads each of 28 strands, so the cloth reads one even rose-mauve with a gold sheen
  (Yoma 72a; Rashi Shemot 28:6); the choshen's stones read as a text by someone facing him (odem top right as you see
  it), coloured after the tribal banners of Bamidbar Rabbah 2:7; the tzitz low on the forehead with hair showing
  (Zevachim 19a); in the blessing his hands at the forehead (Sotah 7:6, lock #37). *Alt:* 36 bells; the wearer's
  right-to-left stone order; other gem identifications (Targum, Rashi, Rabbeinu Bachya); banded threads. *sourced
  reading* / *reconstruction.* *Change:* `src/people/`.
- **E4. Techelet is a clear, deep sky blue, not blue-violet.** Rambam Tzitzit
  2:1, "the likeness of the firmament". *sourced reading* (hue) / *reconstruction* (shade). *Change:* `src/people/`
  palette, `src/world/materials/` (`parochet`).
- **E5. Levites have no Mishnaic uniform: plain undyed beige tunics, cloth belt, optional mantle, bare-headed,**
  warm-toned so they are not taken for kohanim. *Alt:* white linen (Divrei HaYamim II 5:12, First Temple).
  *reconstruction* (flagged). *Change:* `src/people/`.
- **E6. Israelites in natural wool with two darker clavi stripes and a mantle with tzitzit (one strand of eight
  techelet); women in a long dress and a veil over the hair; elders and the Sanhedrin with a head-cloth; mourners in
  black wool with the atifah wound to the sides of the beard and over the mouth (Moed Katan 24a; Rambam Avel 5:19); the
  menudeh wrapped too (Moed Katan 15a leaves it open).** The mourners' black follows Bava Metzia 59b and Middot 5:4
  (and, against A1, Josephus); other colours follow Judean textile finds of the period. *reconstruction* (sourced where
  cited). *Change:* `src/people/` (`roles.js`; roles `mourner`, `menudeh`).
- **E7. Everyone is barefoot on Har HaBayit** (Rambam BhB 7:2). *sourced reading.*
- **E8. Statures: men 1.67 m, women 1.55 m, elders 1.64 m, a Levite boy 1.45 m; skin olive to light brown; dark
  hair.** After skeletal estimates for the period. *reconstruction.* *Change:* `src/people/` role ranges.
- **E9. Kohanim never sleep in the holy garments: asleep they wear their own clothes, the garments folded under their
  heads (Tamid 1:1).** *sourced reading.*
- **E10. Modesty:** immersions are shown with a linen wrap standing for the towel (the immersion itself is without
  garments); bare chests only for the breeches roles; no nipples or body hair. *engineering.* *Change:* `src/people/`
  (`kohen_bathing`, `kohen_breeches`).
- **E11. Animals:** fat-tailed Awassi-type sheep (the alyah requires a fat-tailed breed), the yearling tamid lamb with
  short horns (Tamid 4:3 "its horns between his fingers"), ewes polled; long-haired Levantine goats in seeded coats
  (black 40 %, black-brown 18 %, red-brown 22 %, pied 20 %: Shir HaShirim 4:1, Bereshit 30:32–35; any colour is fit);
  red-brown cattle; males visibly male; the individual's chatat a ewe or she-goat (Vayikra 4:28, 4:32). *reconstruction*
  (breeds, coat weights). *Change:* `src/people/` animals (`roles.js` `coats`).
- **E12. The bound tamid lies on its right side, held by hand and not tied** (Rambam TuM 1:10; Tamid 4:1: head south,
  face west); it hangs by the left hind hock and its head is not flayed (Tamid 4:2). *Alt:* `bound_tied` (Bartenura's
  cord). *sourced reading.* *Change:* the pose used in `src/sim/choreo/g2/`.
- **E13. Instruments:** kinnor of seven strings (Arachin 13b), nevel of ten, both shaped after the lyres on Judean
  coins; silver trumpets about 0.55 m (no length is given); Ben Arza's cymbal a pair of plates. *reconstruction*
  (forms). *Change:* `src/people/` props.

## F. Materials, lighting and look

- **F1. Herodian walls: courses of 1.00–1.20 m from one table; each stone is shayish (~53 %), marmara (~30 %) or kochla
  (~17 %); courses alternately set out and drawn in.** Bava Batra 4a ("like the waves of the sea"), with Rashi on Sukkah
  51b for the mix: the stones differ one from another, and "apik shefa" is the courses' plane, not their colour; the
  report's matrix had courses of each marble. Kochla carries the white's warmth a little deeper, its grey-green only in
  its bedding layers; Magen's "dark kohl-blue" kochla read as stripes and was dropped. *Alt:* a strict three-course
  colour cycle (the report's reading); a darker, bluer kochla. *sourced reading* (per stone) / *reconstruction* (shares,
  tones). *Change:* `src/world/materials/gen/sets.js` (`KOCHLA`, the course table), `src/world/materials/courses.js`.
- **F2. Stone dressing: dry hairline joints, drafted margins with a chamfer up to a pecked boss on the outer and the
  court faces, chipped arrises, dust over the bottom half metre of each wall; otherwise restrained weathering ("the
  building was new").** *reconstruction.* *Change:* `src/world/materials/` (patch.js `MK_FOOT` for the wall feet).
- **F3. The Azarah is paved with large white marble slabs: "avanim yekarot" (Rambam BhB 1:10) is read as costly dressed
  stone, not gems; the Mount with pale marble slabs.** *Alt:* a gem mosaic; limestone. *sourced reading.*
- **F4. The altar is a mass of rounded field stones under thick off-white lime, with the red chut hasikra, soot rising
  above each pile, an ash crust on the top edges and corners, and dried blood at the yesod and the corners below the
  line.** Middot 3:1–4; Zevachim 53a; Tamid 4:1. The blood was first "very restrained" and was made darker and wider
  in QA (up to ~60 % cover). *Alt:* a pristine altar; fainter stains. *reconstruction* (look). *Change:*
  `src/world/altar/`, materials `lime_whitewash*` (patch.js `MK_ALTAR`).
- **F5. The building's plating is gold a little paler than pure (F0 #fae5aa, between natural gold with ~20 % silver and
  pure gold); the vessels, the nivreshet and the golden altar are pure gold (Shemot 30:3).** The sources name the
  plating's metal, not its grade; the shade was set by eye at the final gate. The Shulchan is still built in the
  plating's key although Shemot 25:24 also says pure gold (a one-word change). *Alt:* pure gold everywhere; true
  natural gold for the plating. *reconstruction.* *Change:* `src/world/materials/` (`gold_plate`, `gold_vessel`),
  `src/world/heichal/vessels.js` (`goldTable(H, b, 'gold_plate')`).
- **F6. The parochet: every cord twisted of the four materials (Shekalim 8:5), in a twill, reading as a deep heathered
  red-violet; no woven figures.** A banded design was tried and reverted. *Alt:* keruvim (First Temple / Mishkan);
  colour bands. *reconstruction.* *Change:* `src/world/materials/` (`parochet`, `parochet_kodesh`).
- **F7. Firewood is fig, walnut and pine (Tamid 2:3; "etz shemen" read as Aleppo pine, the common identification); no
  olive or vine.** *reconstruction* (identification). *Change:* materials `timber_bark_*`, `src/world/altar/fire.js`.
- **F8. Roofs are lime (ma'azivah), with no tiles (Middot 4:6).** *sourced reading.*
- **F9. The altar fire is an ordinary wood fire: orange flames, grey smoke, no glow, colour change or smokelessness.**
  The heavenly fire "crouched like a dog" and did not help (Yoma 21b); the visible wonders belong to the First Temple
  (report §32). *sourced reading.* *Change:* `src/render/fx/`.
- **F10. Smoke columns rise straight and nothing in the scene responds to wind** (Avot 5:5; the incense "like a
  stick", Yoma 38a). A miracle is shown as fact here (Top 13). The great pile's column is about 80 m tall, so it stands
  over the walls in the opening view and glows orange at its foot by night; its height is ours. *sourced reading*
  (straight) / *reconstruction* (height). *Change:* `src/render/fx/` (smoke; `presets.js` pyre `smoke.height`).
- **F11. Tone mapping is AgX with a mild "punchy" look,** chosen for marble gradation and stable dawn hues. *Alt:* ACES
  (more vivid fire and gold, clips marble), Neutral; selectable with `?tm=aces|agx|neutral`. *engineering.* *Change:*
  `src/render/pipeline.js` (`TM_GAIN`, the grade).
- **F12. A physical sky for an Eastern-Mediterranean autumn (dust haze, soft whitish horizon); a dark night sky without
  city glow; exposure keeps night dark but legible, not a photographic auto-exposure.** *reconstruction* (aerosol,
  ancient night) / *engineering.* *Change:* `src/env/` (atmosphere, exposure curve).
- **F13. The sky is computed for the chosen date: real Sun, Moon and planets, the stars precessed to that date.** A
  date near 30 CE shows the ancient sky (planets approximate outside 1800–2050). On the default date a half Moon stands
  high with Jupiter and Mars before dawn. *engineering.* *Change:* `src/time/`, `src/env/`.
- **F14. Thin cirrus by season on the high and ultra tiers only, fixed per date (not random per session); `?cirrus=`
  overrides.** *reconstruction.* *Change:* `src/env/sky.js` (the cirrus field).
- **F15. Helena's nivreshet flashes as physical sun glints from about sunrise + 14 minutes, when the Sun clears Har
  HaMishchah** (Yoma 37b), not as an added glow. *sourced reading* / *engineering.* *Change:* `src/render/fx/glint.js`.
- **F16. Interiors follow the eye: the Kodesh by lamplight is darker than by day, the KhK behind two curtains stays a
  dark chamber, firelit rooms read warm.** `?interiors=0` turns the interior model off. *engineering.* *Change:*
  `src/env/` (interiors, exposure).
- **F17. Where the look departs from physics on purpose.** Under a high Moon at full night the sky's ambient is halved,
  so the opening view's wall has shape (the measured moonlit sky would be right, but flat). Fires hidden from the eye
  behind the court walls take their own adaptation gain, so the Heichal's firelit facade reads through the gates instead
  of clipping (fx `GATE_OVER`). Gold's reflections lose most of a blue sky cast and are capped at 10 × the room's mean
  light, so shaded gold does not read olive and a sunlit doorway does not clip it white. On low, the Kodesh's two
  parochot get a daylight colour correction (`parochet_kodesh` `lowDay`) until the low tier's gilded-room light is
  fixed. *engineering* (art direction). *Alt:* the physical values throughout. *Change:* `src/env/index.js` (night
  ambient), `src/render/fx/index.js`, `src/world/materials/patch.js` (`MK_METAL`), `materials/index.js`
  (`LOW_DAY_PAROCHET`).

## G. Sound and music

- **G1. All sound is synthesised in Workers; no recordings.** Follows Top 11. *engineering.* *Change:* `src/audio/`.
- **G2. The Levites' melodies are not preserved, so the song is a modal reconstruction:** unison psalmody on a reciting
  tone with a mediant and a final cadence, a mode on D with B♭, Pythagorean tuning; boy Levites an octave above; the
  kinnorot heterophonic about 10 dB under the voices ("the essence of the song is the voice", Sukkah 50b). An optional
  Renaissance layer follows Shiltei HaGiborim (Mantua 1612, four-voice falsobordone). *Alt:* later synagogue modes;
  Western harmony (rejected). *reconstruction.* *Change:* `src/audio/synth/chant.js`, setting `musicStyle`.
- **G3. Each psalm is split into three sections of about equal verse count (the user asked to keep this division).**
  Three breaks cut across sense units: 24:3|4 (the question "Who may go up?" from its answer), 48:5|6, 82:3|4. *Alt:*
  breaks at Selah and sense units: 24: 1–2 | 3–6 | 7–10, 48: 1–4 | 5–9 | 10–15, 82: 1–2 | 3–5 | 6–8 (the rest
  unchanged). *reconstruction.* *Change:* one line per psalm in `src/audio/songs.js` `SONGS`; choreographies follow
  `sectionTiming`.
- **G4. Every verse is sung, in three sections; captions show each verse in English and Hebrew.** *engineering.*
- **G5. Shabbat songs: Ha'azinu in six parts, one per Shabbat (Rosh HaShanah 31a, divided as Rambam Tefillah 13:5), and
  in the afternoon the Song at the Sea or the Song of the Well; the cycle is counted in whole weeks from Shabbat
  2026-01-03 (the phase is not recorded).** The musaf concert sings that Shabbat's section of Ha'azinu and the
  afternoon concert that week's Shirah, timed from the audio's own clock for the song (docs/decisions/shabbat-songs*.md).
  The melodies themselves are reconstruction (K1). *reconstruction* (the cycle's phase). *Change:* the start week in
  `src/audio/songs.js` (`shabbatWeek`), `src/sim/choreo/g6/common.js` (`haazinuSection`), `g3/song.js` (`shirahOfDate`).
- **G6. Every tier renders the attested minimum on the duchan (12 men, 9 kinnorot, 2 nevalim; ultra 14 men); boy
  Levites 2 to 6 by tier** (their number is not attested). *sourced reading* (minimum). *Change:* `src/audio/`.
- **G7. The nine blasts of the tamid are three teki'ah-teru'ah-teki'ah sets, each opening a section of the song, with a
  prostration at every set; the later sets sound from beside Ben Arza on the duchan** (Sukkah 5:5; Tamid 7:3). *Alt:*
  sets after each section plus an opening set (twelve blasts, against the nine). *sourced reading.* *Change:*
  `src/audio/` `libation()`, `src/sim/choreo/g3/`.
- **G8. Trumpets sound A4, the reciting tone; a teki'ah ≈ 3.1 s; pronunciation is a neutral Sephardi-like reading with
  the stress taken from the accents.** The ancient pitch and pronunciation are unknown. *reconstruction.*
- **G9. The chalil only on the twelve flute days; no organ-like sound** (Arachin 2:3, 10b). *sourced reading.*
- **G10. Real sound levels (40–118 dB) are compressed into the mix keeping their order; "heard in Yericho" is the
  loudest entries, not literal; the Heichal rings longest (5.2 s, gold room).** *engineering* / *reconstruction*
  (acoustics). *Change:* `src/audio/` loudness model, reverb table.
- **G11. Night insects follow the season and the night's temperature (sparse, slow chirps on 2 November);** the weekday
  prostration is silent (spoken responses belong to Yom Kippur). *reconstruction* / *sourced reading.*

## H. Time, calendar and defaults

- **H1. Default date, time and place:** see Top 2.
- **H2. Reckoning and time zone:** see Top 3. The night's seasonal hour is (1440 − day length) / 12, so the evening and
  the pre-dawn hours join; chatzot is sunrise + 6 seasonal hours. *engineering.* *Change:* `src/time/`.
- **H3. The Hebrew date comes from the browser's Hebrew calendar and turns at sunset; the psalm of the day follows the
  civil weekday.** *engineering.*
- **H4. Zmanim use sea-level angles; the sky and light show the real, later sunrise over the ridge.** A visitor reading
  "sunrise" in the panel sees the Sun about 20 minutes later. *Alt:* elevation-adjusted zmanim. *engineering.*
- **H5. Playing past midnight moves to the next civil date** (Friday 23:59 → Shabbat 00:00); `set(t)` keeps the date.
  time-env.md still describes the earlier wrap to 00:00 of the same date. *engineering.* *Change:* `src/time/index.js`.
- **H6. Day type comes from the weekday only (Top 9).** Seasons enter only through the offerings (bikkurim). *engineering.*
- **H7. Quality defaults to `auto` (J3).** *engineering.* *Change:* `?q=`, Settings.

## I. Interaction and UI

- **I1. Walk anywhere, with a notice at rung 7 and above (Top 10).** The notice shows once per place per 90 s and not
  while subtitles are off. *engineering.* *Change:* `src/ui/hud.js` (restricted-place notice).
- **I2. Door leaves and curtains are not colliders;** shut doors only shape the sim's and the map's paths
  (`findPath(…, { closedDoors })`). *Alt:* collide with shut leaves (the observer could then be locked out at night).
  *engineering.* *Change:* the collider filter in `src/player/physics.js`.
- **I3. "Go" walks the route at the chosen speed (instant, slow 0.8, walk 1.4, fast 2.4, run 4.5 m/s); the last speed
  chosen is remembered; a target the walk cannot reach ends with a fade-teleport.** *engineering.* *Change:*
  `src/player/goto.js`, setting `travelSpeed`.
- **I4. The map is a near-full-screen overlay: a click selects a place, a double-click goes, and "Go" closes the map so
  the walk is seen in the world.** *Alt:* click to go (a mis-click sends the visitor across the Mount). *engineering.*
  *Change:* `src/ui/map/`.
- **I5. The time dial is uniform in seasonal hours (day across the top, night across the bottom); civil times always
  carry "≈"; events carry their timing badge.** *Alt:* a 24-hour civil dial. *engineering.* *Change:* `src/ui/`.
- **I6. Sources link to Sefaria only where the mapping is unambiguous; everything else is plain text.** *engineering.*
  *Change:* `src/ui/` (citation linker).
- **I7. Changing the quality or the amah reloads the page in place (position, view, time and date kept).**
  *engineering.*
- **I8. Movement:** arrows turn, A/D strafe; fly mode is noclip; a subtle head-bob on by default (off with reduced
  motion); body radius 0.30 m, eye 1.62 m, step-up 0.35 m (clears every half-amah riser under all three amot).
  *engineering.* *Change:* `src/player/`, setting `headBob`.
- **I9. Captions and verse subtitles show even while sound is off, when the call would be audible where you stand.**
  *engineering.* *Change:* setting `captions`.
- **I10. "Go" to an event chooses its own stand when the authored one would not show the rite.** Each event's view is
  checked against its figures at the moment: if they are not in sight it stands on rings round the nearest figure; some
  events follow their man (the clearer, the fire-pan man, the metzora, a vessel bearer, the Ish Har HaBayit); the
  arrival steps aside from anyone within 0.8 m and pitches toward the event. A row is listed only while it is staged.
  *Alt:* only the authored views (they go stale whenever the staging moves). *engineering.* *Change:*
  `src/sim/lib/watch.js` (`createAutoView`), `src/player/goto.js` (arrival).

## J. Performance and tiers

- **J1. three.js WebGLRenderer, not WebGPU.** The shader patches (fog, interiors, materials, people), the ANGLE/D3D11
  tuning and the warm-up are written for WebGL 2. *Alt:* WebGPURenderer (a port of every patch). *engineering.*
  *Change:* `src/core/engine.js`.
- **J2. Four tiers, with low tuned against an Intel HD 4600.** Low: a static sun shadow (the world only, re-drawn when it
  changes; one PCF tap; figures keep contact shadows), FXAA, volume AO, no post, no probes; medium: one key shadow
  (static world cached, figures each frame), volume AO, bloom, SMAA, probes; high: N8AO, two sun cascades, one
  fire-shadow slot; ultra: full-resolution AO, sun shafts, two fire-shadow slots. Each feature is a flag in the tier
  (`shadows`, `shadowFilter`, `aa`, `ao`, `interiors`). *engineering.* *Change:* `src/core/quality.js`, `src/render/`,
  `src/env/visibility.js` (docs/decisions/lowend-visuals.md).
- **J3. The automatic tier uses the GPU name and a short benchmark, at most medium on phones and on CPUs with ≤ 4
  threads, at most high under 8 threads,** because a first visit compiles every shader on the CPU. *Alt:* start every
  first visit at medium and offer an upgrade. *engineering.* *Change:* `src/render/detect.js`.
- **J4. Cold first-frame times on the HD 4600: low ≈ 13 s, medium ≈ 22 s, high ≈ 30 s, ultra ≈ 37 s;** what the first
  view does not show compiles afterwards (surfaces may show their flat colour for a moment). *engineering.*
- **J5. Budgets per tier (low / medium / high / ultra): figures 60 / 180 / 450 / 1200, with up to three times as many
  far silhouettes; distinct prop batches 14 / 22 / 34 / 56; fire lights 2 / 4 / 8 / 12.** The sim's crowds scale with
  the tier as well, so low shows fewer people (D2). *engineering.* *Change:* `src/core/quality.js`,
  `src/people/system.js` `PROP_BATCH_CAP`.
- **J6. Texture memory: low ≈ 22 MB, high ≈ 193 MB;** the hero wall texture 1664 px. *engineering.* *Change:*
  `src/world/materials/` set sizes.
- **J7. The interior light model costs about 4–9 ms a frame on low; accepted so interiors read dark on the weakest
  tier.** `?interiors=0` turns it off. *engineering.* *(lowend-visuals: on low and medium the per-opening loop is replaced
  by a load-time visibility volume — each room's openings per cell × the live door weights — which drops the key light's
  per-opening mask (the shadow map does it) and the exits through openings other than the main one; `?visvol=0` restores
  the exact path.)*
- **J7a. Low's AO is a 2 m precinct grid computed once per geometry in a Worker (≈ 3 s after the boot's compiles drain;
  cached in IndexedDB), applied to the sky and room light only, strength 0.75.** *Alt:* screen-space AO (a post pipeline
  low does not have), a finer grid (memory, time). *engineering.* *Change:* `src/env/visibility.js` `VIS`.
- **J8. The choir renders at 32 kHz on low and medium.** *engineering.*

## K. Publishing and repository

- **K1. No licence for the project's own code and content (the user's choice).** README says all rights are reserved
  until one is added. *Options:* MIT or Apache-2.0 for everything; code under MIT/Apache with content under CC BY 4.0 or
  CC BY-SA 4.0; GPL/AGPL; or all rights reserved on purpose (`"license": "UNLICENSED"`, drop "yet" from the README).
  *engineering.* *Change:* add `LICENSE`, `package.json` `license`, README "Credits and licences", About panel credits
  (qa-r2-docs.md lists the steps).
- **K2. Every commit carries the user's personal email in a public repository.** *Options:* keep it; set this repo's
  `user.email` to the GitHub noreply address for future commits; rewrite the history's author and committer email
  (`git filter-repo --mailmap`), which now changes every hash and needs a force-push. *engineering.*
- **K3. Fonts load from Google Fonts, so visitors' browsers contact Google.** Self-hosting was not done because it needs
  the woff2 files downloaded, which was not approved. *Alt:* self-host the three OFL faces. *engineering.* *Change:*
  `index.html` (font loader), `src/ui/index.js` `FONTS_URL`, `src/ui/aboutpanel.js` `FONTS_HOST` (set to null).
- **K4. The Pages address is hard-coded in three README links (live site, example, licence texts);** the share cards
  follow the deploy. Change them if the repo is renamed or moves to a domain. *engineering.*
- **K5. The research report and the Hebrew texts are not published;** README, ARCHITECTURE.md and the errata refer to
  `../report/parts/` and `../sources/`. So the app's own text never cites the report: every claim names its primary
  source, a named commentator (Ezrat Kohanim by the mishnah it comments on, not by scan page) or "Reconstruction
  (model)", and `validate-schedule.mjs` fails on a `§N` or `lock #N` in any public string. *Alt:* publish them, or a
  summary with the locks, and let the app cite it. *engineering.* *Change:* `tools/validate-schedule.mjs`, the texts in
  `src/data/`.
- **K6. The decision logs in `docs/decisions/` are public.** They are working notes, with machine details and paths
  outside the repository. *Alt:* keep this digest and site-model.md public and move the logs out. *engineering.*
- **K7. Deploy:** the workflow validates the schedule before every build; `configure-pages` runs without
  `enablement: true`, so Pages must be switched to "GitHub Actions" by hand. *engineering.* *Change:*
  `.github/workflows/deploy.yml`.
- **K8. The share card is the project's own render: from above the north-east of the Mount at sunrise + 25 min, the
  Heichal's facade and the altar's smoke.** It was shot while other visual fixes were still landing; the command to
  re-shoot it is in qa-r2-core.md. *Alt:* the opening view (reads as a wall at card size); a court at eye level (the
  faces are still stylised). *engineering.* *Change:* `public/og-image.jpg`, `og:image:alt` in `index.html`.

## L. Open points the logs leave for a decision

Inconsistencies and pending requests found while building, each small, none fixed yet.

- **L1. The Shulchan is plated in the walls' gold key, though Shemot 25:24 says pure gold** (the golden altar was
  switched; F5). *Change:* `src/world/heichal/vessels.js`.
- **L2. Beit Garmu's kneading table stands in Beit HaMoked's kodesh half, while Menachot 11:2 puts the kneading
  outside;** the sim kneels its kneaders with a bowl in the chol half instead. *Change:* a table in the chol half
  (`src/world/courts/moked.js`), then `knead` in `src/sim/choreo/chambers-daily.js`.
- **L3. Whether the avnet stays on for preparation work** (incense, hides, baking) is undecided (E2).
- **L4. Resolved:** Ha'azinu and the Shirah are now sung, not Psalm 92's chant (G5).
- **L5. From the ramp's top at night the ramp itself stays unlit by the great pile,** because fx puts the pile's merged
  light 0.6 × its size over its base, just below the ramp's plane; logged open, with the fix (a light at the flames'
  height, ≥ +30 amot), in world-3-fix.md. *Change:* `src/render/fx/presets.js` (pyre `light.height`).
- **L6. The mourner on Shabbat** (D13) and **the climb over the kalya orev** (B31), both kept and noted for review.

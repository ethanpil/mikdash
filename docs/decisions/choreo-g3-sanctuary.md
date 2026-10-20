# choreo-g3-sanctuary — decisions

Format: **Choice** — why (source / reasoning) — alternative. ⚙ = reconstruction (minutes, spots, speeds, counts the
sources do not give). Code: `src/sim/choreo/ketoret-morning.js` (the module) and `src/sim/choreo/g3/*` (places, the
timeline Script, the per-date plan, the morning, song and afternoon builders). Test: `src/sim/dev/tests/g3.js`.
Shots: `shots/choreo-g3-sanctuary/`.

## Engineering

- **One module serves all five G3 choreo ids (`ketoret-morning` with aliases `birkat-kohanim`, `menorah-lighting`,
  `libation-song`, `maamad`).** — The same kohanim run in at the magrefah, withdraw at the incense, prostrate in the
  Heichal and bless from the Ulam's steps; the same Levites stand on the duchan from the magrefah to the end of the song;
  the ma'amad prostrates at the incense, the blessing and every teki'ah. One module keeps each of them one figure (no
  swap at window edges) and one crowd. — Five modules handing figures over at window edges with matching seeds.
- **`always: true`.** — The Menorah's lamps, the vessels left on the silver table and the magrefah by the SW corner are
  functions of the hour all day; a jump to any hour shows them right. The update early-outs to almost nothing at night.
- **Timelines from authored straight legs with analytic floors (`places.floorAt`).** — The Ulam's twelve steps, the
  ramp, the duchan, the fifteen steps, the stone before the Menorah, the marble table and the yesod ramp's ledge come
  from their site profiles: no physics query per walking figure (budget < 0.5 ms for the group). Steps are smoothed over
  ±0.3 amah so a climber rises with his stride. — Physics floors (≈ 0.025 ms per moving figure per frame).
- **Figure continuity with neighbours by seed:** the two clearing men use gates.js's seed (0x6764) — the Menorah's man
  appears at the ta door while the great gate is opened, the gate's opener turns from it to the inner altar as
  inner-clearing begins; the incense and fire-pan men are lotteries.js's circle slots 3 and 4 (seed 0x6745) and come out
  of the Gazit's east door as the lottery ends; on Shabbat the Kohen Gadol and the segan use tamid-morning.js's seeds
  and meet it at the north end of the apron at limbs-up − 0.15/0.05 and take them back at the SW corner at limbs-up's
  end. — New faces in every scene.
- **The libation concert is the audio's own parts, staged on one timeline and spread over the song's window (g3/plan.js
  `libTimeline` + `spreadTimeline`).** — The first set on the table, the step down, the walk to Ben Arza (the audio's
  25-s maximum), the pour and cymbal and the first section keep `ctx.audio.libation`'s order and buffer lengths (`D_SET`,
  `PSALM_DUR`, checked by the test against the synth). The three sections, with the second and third sets between
  them, then fill the song's window, and the last note falls a minute before the window closes. The audio has only the
  opening verses of each third, so each section is its `choir-psalm` cue followed by the `choir` loop of the same section
  until the section ends. The loop is a level, like the hush: it also sounds after a jump into a section, and is off
  while paused or above 8×. `ctx.audio.libation()` is no longer called, because its back-to-back order cannot be spread;
  every part is a separate cue at its staged moment, at any speed. *Review fix (2026-10-20)*: before, the whole concert
  lasted about 1.7 min and the Levites stood idle for the rest of the 14-min song window. ⚙ the section lengths: the
  sources give the order, not minutes.
- **The pour is in the libation's window (at most libation t0 + 2.6, i.e. 0.65 of the window); the afternoon's first set
  is at afternoon-song t0 + 0.9.** — The libation event describes the trumpets on the table, the pour, the sudarin and the
  cymbal, so its visitor sees them: the wine is taken at t0 + 0.5, set 0 at about t0 + 1.9, and the pour at t0 + 2.6. The
  song event's visitor lands in section 0 being sung (the loop) and gets the song-of-the-day caption at t0 + 0.5, then
  sets 1 and 2 at about t0 + 3.3 and t0 + 8.2 (weekday). After the pour the pourer and the segan go down (pour + 0.75 min);
  the trumpeters stay by Ben Arza for the later sets ⚙.
- **Shabbat: the Levites go back to their chambers between the tamid's song and the musaf's** when the gap is over 8 min
  (about 30 min on 2026-11-07). They walk back up 4 min before the musaf's first set ⚙. Before, they stood idle on the
  duchan the whole time. The musaf's concert (G6's L0, walk and pour, the same lengths) is spread to its window's end − 1
  min (at most 14 min).
- **Shabbat afternoon: the Song at the Sea / the Song of the Well (Rosh HaShanah 31a), not Psalm 92.** — The three-week
  cycle "Az yashir", "Mi chamocha", "Az yashir Yisrael" is counted from Shabbat 2026-01-03, as shabbat-musaf counts
  Ha'azinu ⚙ (the cycle's start is not given). The audio has no text for them: the melody is Psalm 92's with its own
  caption off (`caption: false` reaches every `choir-psalm` cue), and G3 captions each section with what is sung,
  marking the chant as a stand-in (requested from audio).
- **Free vessels are people props (`spawnProp`) with day windows:** the Teni by the golden altar and the Kuz on the
  stone's second step between the morning cleanings (Tamid 3:9 → 6:1); the gold pan and the kaf on the silver table
  (Shekalim 6:4) until taken, the gold pan on the yesod ramp's ledge while the coals are poured into it, each vessel
  set down beside its man while he prostrates; the Teni, the Kuz, the gold pan and the kaf back on the silver table after
  the blessing until the locking ⚙; the magrefah lying by the SW corner, then where it fell until a kohen puts it back.
- **The silver pan's niche (`altar.machtah`) is hidden while the fire-pan man has the pan, and shown otherwise between
  inner-clearing and the locking** — terumat-hadeshen drives it at dawn; outside that range this module does not touch
  it (no conflict).
- **The module claims `shabbat-musaf-song` (export `claims`).** — shabbat-musaf (G6) publishes the musaf's concert
  (`g6/musaf.js musafConcert`: the pour, the libTimeline-shaped timeline, the wine's place and pick-up) for libation-song
  to stage. On Shabbat the Levites come back up from their chambers for it (above); the brother who carries the wine
  comes back from the south chambers for the musaf's wine, the afternoon trumpeter slots serve the musaf, the segan comes
  again from the Gazit; the audio is the same separate cues with G6's Psalm 92 stand-in and its captions off (G6
  captions the pour with the Ha'azinu section); the ma'amad stays until the musaf's song is over. — Leaving G6 to stage trumpeters alone (no Levites, no segan, no Ben Arza on the duchan).
- **The Menorah's branch lamps are switched to fx schedule 'service' at runtime** (the builder registers them 'night',
  which keeps them dark in daylight although the lighting is at 9.3 seasonal hours). Requested from build-heichal.

## Research-driven staging

- **Inner clearing (Tamid 3:9):** the inner altar's man sets the Teni before him, scoops the ashes by hand (kemitzah
  pose), sweeps the rest in (stooped), leaves the Teni and goes out; the Menorah's man stands on the top step of the
  stone (site `heichal.menorah.params.stone`), cleans lamps 6→2 (the five west of the two eastern — lamps run E–W, lock
  #11), leaves the Kuz on the second step and goes out. Both go out to the Gazit. ⚙ order west→east.
- **Coal-pan (Tamid 5:4–5; Zevachim 6:3):** the fire-pan man takes the gold pan from the silver table and the silver pan
  from its niche (stooping from the yesod ramp's ledge, as terumat-hadeshen does), goes up the ramp on its east side and
  round the altar to the right — SE, NE, NW — to the incense pile opposite the SW horn (Tamid 2:5), clears the coals
  "this way and that" and scoops, goes down on the west, stoops over the gold pan on the ledge with the silver pan low
  over it (the bow's stoop: no bent-pour pose yet — requested), the coals glowing in it (a small brazier: an ember bed
  with low flames, so it reads in daylight ⚙); the scattered coals
  are swept stooping into the amah's open channel west of the yesod ramp (site `azarah.amah-channel`); on Shabbat he
  bows over them for the psachter (no prop yet — requested). The silver pan goes back into its niche. ⚙ The gold pan
  standing on the ledge while he scoops (the Mishnah: "he came down and emptied them into the gold one").
- **The incense man takes the kaf with the bazach from the silver table (Tamid 5:4)** ⚙ (the source does not say where
  it stood; Shekalim 6:4 puts the service vessels on the silver table). His friend walks with him.
- **The magrefah (Tamid 5:6):** thrown down by the inner altar's man (⚙ "one of them") on the open pavement between the
  Ulam and the altar, east of the muchni's wheel (the steps fill the strip in front of the Ulam), as the fire-pan man
  arrives with the coals. Kohanim run in from the Gazit's court (nine), Beit HaMoked's hall (five) and Lishkat
  HaMedichin (four) ⚙ to the foot of the Ulam's steps; the Levites run from their chambers under Ezrat Yisrael (Middot
  2:6) up the fifteen steps on two radial lines clear of the gatekeepers and the impure waiting below. The crowd's murmur
  is hushed from the crash until the people's prostration (ctx.audio.ambience.hush, re-applied after a jump into it).
- **Into the Heichal (Tamid 6:1–2):** the two clearing men first; the inner altar's man takes the Teni, sets it beside him
  while he prostrates east of the golden altar (a full-length prostration cannot hold a vessel ⚙), takes it up and goes
  out; the Menorah's man cleans the eastern lamp and leaves the western burning, takes the Kuz from the second step,
  prostrates (the Kuz set beside him); the fire-pan man heaps the coals (pour) and spreads them with the rim of the pan (sweep), sets
  the pan beside him, prostrates. The brothers climb to the upper rovadim.
- **The incense (Tamid 6:3; Yoma 44a):** the bazach handed to the friend, the incense poured into the incense man's
  hands — he first sets the emptied kaf down beside the golden altar, and holds both palms cupped ('wave' held at phase
  0) while the friend pours, through the warning, "Hakter!" and the withdrawal (נוֹתְנוֹ לוֹ בְחָפְנָיו); the friend goes
  out; the memuneh calls "Hakter!" from the head of the steps; everyone withdraws from the Heichal and from the whole
  strip between the Ulam and the altar (site zone X 179–201): the brothers north of the altar, the servers south-west of
  it; he steps to the altar and lays the incense on the coals from his cupped hands, moving them to and fro over it (the
  'wave' pose's to-and-fro half — a stand-in for spreading ⚙); the incense column (fx `smokeColumn` kind 'incense', 9 m,
  straight) and his prostration; he takes the kaf up again after it; the gate curtain hangs closed while he
  is alone and is lifted for each who passes (Tamid 7:1 "he lifted the parochet") ⚙.
- **The prostrations (Tamid 7:1):** on Shabbat the Kohen Gadol (who serves on Shabbat — tamid-morning.js) comes from the
  Gazit before the withdrawal, waits north of the altar, and goes in held by three (the segan at his right, a kohen at
  his left, one by the stones), prostrates; the memuneh lifts the curtain as he comes out; only then the brothers go in.
  The brothers prostrate together in two blocks either side of the Kodesh's axis (the aisle free), east of the golden
  altar. **The people in the courts prostrate with them** (report §28 #7 "then all prostrate"); the Levites on the
  duchan bow (its step is too narrow to lie full length) ⚙.
- **Birkat Kohanim (Tamid 7:2):** three rows on the first three rovadim facing the courts, hands above their heads
  (`raise_hands`; people draws `raise_hands_low` for the Kohen Gadol — the stam, Sotah 7:6); the five with the Teni,
  Kuz, fire-pan, bazach and kaf (carried) to the south of their brothers; on Shabbat the Kohen Gadol on the top landing.
  Caption with the Name substituted (ה׳). **The people's response "Baruch shem kevod malchuto le'olam va'ed" and their
  prostration** — Taanit 16b (in the Mikdash they did not answer Amen); the prostration at the blessing follows the
  report (§36.4 #6 "the crowd flat on the stone"). After it the Teni's and the Kuz's ashes go to Beit HaDeshen (site:
  it receives the inner altar's and the Menorah's ashes) and the vessels back to the silver table ⚙.
- **The libation (Tamid 7:3; Sukkah 4:9; Zevachim 6:3):** the pourer (weekday: one of the brothers; Shabbat: the Kohen
  Gadol, handed the wine by him) takes the wine from the lower ramp at libation t0 + 0.5 (tamid-morning.js removes its
  jug then), goes up the ramp's west half and left to the SW corner, pours toward the silver cups at the SW horn, and
  later goes back down the same way ("on his heel"). He stands on the walkway's edge facing south, the 'pour' pose's
  hand over the cups' centre (places `pourStand`), stoops (bow to 0.4) and then pours (the pour clip from its raised
  arm, the tilt across the cymbal) — "he bent to pour" with the poses there are (a bent-pour pose and a wine stream are
  requested) ⚙. On Shabbat the Kohen Gadol, handed over at the corner (tamid-morning's `swAt` = places `pourAt`), steps
  to the same spot. The segan stands at the corner with the sudarin, a cloth in each hand, and signals: the right hand
  raised and dropped five times around the cymbal ('torch' arm up, the cloth hanging from the fist, then 'stand'); the
  'wave' pose laid the cloths flat on his palms like a tray ⚙. The two trumpeters stand ON the marble table of the fats (two on a
  1 × 2-amah top, one at each end), blow, step down and go round the ramp's foot and up Ezrat Kohanim to stand at Ben
  Arza's right and left on the duchan (≈ 44 m in the audio's 25 s — a hurried walk) ⚙.
- **The duchan (Middot 2:6; Arachin 2:3–6; Shekalim 5:1):** twelve Levites on its one-amah step, facing the altar ⚙
  (Rambam BhB 6:6 "standing on the duchan … saying the song over the offering"): nine kinnorot, two nevalim and Ben Arza
  with the one cymbal (the audio renders the same forces); Ben Arza on the axis. North of the axis the line leaves a gap
  at Y ≈ 335.5–338.5, where courts-daily's kohanim cross the duchan to and from Lishkat Pinchas (`PINCHAS_WAY`), so the
  Levites stand at dy 3.2, 4.8, 8.6, 10.2, 11.8, 13.4 there ⚙. Four Levite boys on the pavement of
  Ezrat Yisrael at the step's foot, between the men, their heads at the men's legs ("their heads between the Levites'
  feet", REbY). Kinnorot and nevalim are played (play_* poses) only while the sections are sung; at each set the Levites
  stand and the people prostrate.
- **Three sets, nine blasts, three prostrations** — the audio's reading (Sukkah 5:5's nine blasts; a prostration at the
  opening set too). The staging follows it exactly.
- **The ma'amad (Taanit 4:2):** Israelite men (some elders) standing in Ezrat Yisrael north of Lishkat Pinchas, facing
  the Heichal, laid out with room to prostrate (people's 'prostrate' layout), never seated; three bands arrive and leave
  staggered, with a stream of men walking in (and out) through Nikanor's gateway. Count 30 (× crowdScale) ⚙. The same
  crowd prostrates at every prostration of the day (incense, blessing, the three sets ×2).
- **The afternoon (Yoma 14b–15a, 26a, 44a):** the morning's order, shorter: coal-pan, the coals heaped, the incense by a
  new man (weekday the morning's fire-pan man; Shabbat the incoming watch's — other faces), the withdrawal and hush, the
  people's prostration ⚙; then the Menorah's man lights the six lamps from the western one (a light taken from it, then
  outward from it ⚙), prostrates and goes out. No magrefah and no Birkat Kohanim in the afternoon (the sources give them
  for the morning).
- **Lamps:** lamp 1 (the second from the east, site `nerMaaravi`) is always lit; the others burn from their evening
  lighting until their morning cleaning (Tamid 3:9, 6:1; Shemot 27:21).

## Verification (2026-10-19, HD 4600, low)

- `src/sim/dev/tests/g3.js`: figures, vessels, lamps, fires, curtain and crowd identical at 49 weekday instants (and the
  Shabbat set) under three jump orders; at 120× every cue key once, no sound twice at one moment, nothing on jumps; at
  1× through the morning concert `ctx.audio.libation` is called once and no separate part is played; jump-to-event: the
  headline of each of the 13 G3 events (inner-clearing … maamad-afternoon) fires after the UI's landing; module cost
  per frame avg ≈ 0.17 ms, p95 ≈ 0.30 ms, max ≈ 0.38 ms during the plays; PSALM_DUR matches the synth.
- Shots (`shots/choreo-g3-sanctuary/`): every event from its schedule view, and closer views where the view hides the
  action (magrefah-throw, levites-run, coal-pour, trumpeters-table, kodesh-prostration, song-boys, ketoret-withdrawn,
  maamad-prostrate, shabbat-blessing, shabbat-libation). Fixed after the first round: the segan stood in the incense
  pile (moved east of the pourer); the incense column was a few faint puffs (9 m, wider, denser: a connected column on
  low); the golden altar's coals flamed like a lamp (smaller); the ma'amad's cells were narrower than a full-length
  prostration (the court's full width now).
- **Schedule views that hide the action (requested):** `maamad-*` [252, 352] h200 stands inside the crowd and looks into
  Lishkat Pinchas' north wall; `magrefah` [186, 290] h40 sees the muchni's wheel, not the throw.
- **The incense column (fx `smokeColumn` kind 'incense'):** 9 m, 0.5 m wide. fx lights smoke with the outdoor sun and
  sky (no interior visibility), and on medium and above the exposure adapts to the dim Heichal, so at density 0.32 the
  column was a blown-out glowing shaft (report §32 rules glow out). **Requested from render** (env interiors' V applied
  to smoke columns). Until then the density is per tier: low 1.0, medium 0.043, high 0.03, ultra 0.023. High was chosen
  from a sweep of 0.32 / 0.08 / 0.03 / 0.012 / 0.005 at 07:01; medium and ultra are scaled by their puff counts. The
  afternoon column is ×0.55, because the Heichal is darker then and the outdoor-lit smoke is brighter. When the render
  fix lands, `INCENSE_DENSITY` in ketoret-morning.js must go back up.
- The high-tier shots also logged a materials shader error ('soft' undeclared) and matgen 'logs'/'bark' fallbacks, both
  outside G3.

## Review fixes (2026-10-20, `shots/choreo-g3-sanctuary-fix/`)

- **Incense glow (high):** the per-tier density above. Shots high-ketoret, high-ketoret-pm, high-kodesh-prost,
  medium-ketoret and medium-ketoret-pm show grey-white smoke, with no shaft or halo. The golden altar's coals and the
  coals on the ledge have no point light (fx `light: false`), because the coals on top lit the altar's own sides.
- **Song idle for most of its window:** the concert is spread over the window (above). The test's "alive" check samples
  every half minute from the first section to the last note, for the morning and the afternoon.
- **Shabbat afternoon captioned as Psalm 92:** fixed with the Shirah captions and the Psalm 92 caption off (above).
- **The pour not legible:** the pourer now stands at `pourStand`, stoops, then pours with the jug over the cups. The
  segan's sudarin hang from a raised fist. The bent-pour pose, a wine stream and hanging cloths in a wave are requested.
- **Per-frame cost over 0.5 ms at the prostrations:** the ma'amad's three bands prostrate 0, 0.55 and 1.2 s apart, and
  their phase is quantised to 1/240. The 18 brothers go down up to 0.7 s apart (seeded), not in lockstep.
- **One crowd / the G4 path:** the Levite line leaves a gap at the duchan crossing of `PINCHAS_WAY` (above). G4 still
  has to read `peopleProstration` (requested).
- **The kaf and the cupped hands:** the incense man sets the kaf down, then holds his cupped hands out and lays the
  incense on from them. The "⚙" glyph is removed from the afternoon prostration caption (no user-facing text carries it).
- **Coal pour:** a stoop over the gold pan, which now sits 0.5 m before his feet, with the silver pan held over it. The
  coals in the pan are a small brazier (size 0.1) and show a flame in daylight (high-coal-stoop).
- **Views and the magrefah:** the schedule-view and full-size-magrefah requests stand. The views are schedule-data's;
  the prop is people's.
- **shabbat-musaf after a date change:** the test now switches to Shabbat mid-session and checks that shabbat-musaf has
  not failed. It had not failed in either run of this fix. The claim toggle does not change any of G3's pools or slots.

### Verification (2026-10-20, HD 4600 under heavy parallel load)

- `src/sim/dev/tests/g3.js` (low):
  - **Determinism:** identical at 50 weekday instants under three jump orders, and at 13 Shabbat instants under two.
  - **Cues at 120×:** all 60 keys fired once (trumpet-set 7, choir-psalm 7, cymbal 3, crowd-prostrate 10, magrefah 1).
    Nothing fired twice at one moment, and jumps fired nothing.
  - **At 1×:** the opening fired trumpet-set, crowd-prostrate, cymbal and choir-psalm once each as separate cues, then
    the `choir` loop of section 0. `ctx.audio.libation` was not called.
  - **Jump-to-event:** all 13 headlines fired (libation → libation-pour; song-weekday → song-day).
  - **Alive:** 56 of 57 half-minute samples across both song windows show at least 8 Levites or boys playing or
    singing, a set being blown, or the people prostrate. The other falls in the 7.5-s pause between a section's last
    note and the next set.
  - **Shabbat:** shabbat-musaf did not fail after the mid-session date change. The afternoon's Psalm 92 caption is off
    and three "Az yashir Yisrael" captions are planned (week 3 of the cycle on 2026-11-07). No Levites stand on the
    duchan between the songs.
  - **Cost:** avg 0.169 ms, p95 0.296 ms, max 0.39 ms per frame, with no frame over 0.5 ms (the earlier run had one
    0.71 ms EMA spike at 07:34, where G3 does nothing new; not reproduced). PSALM_DUR matches the synth.
- `npx vite build`: passes (ketoret-morning chunk 77.3 kB, 27.2 kB gzip); the output dir was deleted.

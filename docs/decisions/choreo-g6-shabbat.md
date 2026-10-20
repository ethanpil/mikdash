# choreo-g6-shabbat — decisions

Group G6: Shabbat and Friday — `shabbat-musaf`, `shabbat-showbread`, `shabbat-mishmar`, `shabbat-eve`
(src/sim/choreo/*.js) with shared helpers in src/sim/choreo/g6/ (common.js places and cues, musaf.js the musaf builder,
bread.js the showbread plan shared by the change and the division). Test: src/sim/dev/tests/g6.js.

Format: **Choice** — why (source / reasoning) — alternative. ⚙ = reconstruction (the sources fix the order, not the
spot or the minute).

## Engineering

- **G2's toolkit (g2/lib.js `Script`, `FreeProps`, `runScripts`; g2/places.js) is imported, not copied.** — The same
  determinism model as the tamid (every figure a Script built once per date, evaluated with `since(t, t0)`), the same
  ways and spots, one place to fix. — A private copy (drifts from G2's fixes).
- **The showbread plan is one builder shared by two modules (g6/bread.js, cached per `sim.generation` on ctx).** The
  eight of the change belong to `shabbat-showbread` until the division's start (D0), then to `shabbat-mishmar`, whose
  pools use the same seeds: slot i is the same man, standing where the other module left him (test: 0.000 m at D0).
  The bread on the gold table is a free prop in the first module until D0 and in the second after. — One module with
  `aliases: ['shabbat-mishmar']` (simpler, but the schedule's ids would not each have a file).
- **Faces carry over from G2: the musaf crew uses tamid-morning's crew seed and slots (the morning's winners), the
  limbs-up men its fourth-lottery seed; the incoming watch uses G2's Shabbat-afternoon crew seed.** — Rambam TuM 4:9
  (below); the incoming who bring the new bread are the men who offer the afternoon tamid. The windows never overlap
  (tamid-morning's crew is in the Gazit from ~06:45, its limbs-up men from ~07:32; the afternoon crew appears ~13:15).
- **Cues: every caption and sound through `cueAt` (g6/common.js `say`), each ≥ CUE_LEAD after its event's start.** —
  The jump-to-event lands at t0 + 0.25. Test: each key once at 120×, none on 16 jumps across cue moments.
- **Cost: measured per update in a batch of 2000 calls at the busiest minutes (low tier): shabbat-mishmar 0.059 ms
  (the walk-out), shabbat-showbread 0.043 ms (0.031 without its smoke), shabbat-musaf 0.026 ms.** The harness's
  per-frame figure (runtime EMA of `performance.now()` samples, quantised to 0.1 ms in the page) averages 0.13–0.16 ms
  over the musaf, the change, the division and the Friday blasts at 120×; its maximum (0.50–0.57 ms) is a single
  preempted sample when the machine is under load, not the modules' work.
- **Verification views differ from some schedule views (requested, each proved by a shot in
  shots/choreo-g6-shabbat-fix):** Friday blasts — on the Water Gate's terrace at Beit Avtinas's door [216.3, 261.2, 36]
  heading 78 (from anywhere in the court, the ramp or the altar top the terrace's 2-amah parapet leaves only their
  heads, ~10 px at 20 m — shot fri-A-ramphead); showbread-swap — along the Shulchan's axis from the east
  [135.6, 337.5, 22] heading 271 (the two rows face each other across the table; from the south-east the near row
  hides it); bread-warm — inside the Ulam's open front [171.0, 323.6, 22] heading 270 (the gold table's east side is
  kept clear); the schedule's [170, 333] heading 270 looks into the Heichal, away from the table.

## shabbat-musaf

- **The crew is the morning tamid's: "whoever won a task at the morning tamid does it for the two musaf lambs"
  (Rambam TuM 4:9), task by task as this project stages the tamid.** The same slaughterer slaughters both, the same
  receiver receives and throws both bloods, the same six bearers carry both lambs' parts to the ramp, the second
  lottery's flour and wine men bring the flour and the wine to the ramp (TuM 4:6: "the eleventh brings up the flour …
  the thirteenth the wine"); the fourth lottery's men take the limbs AND the flour up from the ramp (tamid-morning's
  U[0..6]; U[6] is its flour man — fixed in the review: the second lottery's flour man had taken it up); the wine is
  taken up and poured by the man who took the morning's wine up from the ramp — libation-song's brother 12, who on
  Shabbat morning carries it up and hands it to the Kohen Gadol (Tamid 7:3): the same pool slot, so the same face.
  When libation-song does not stage the pour, this module stages that man itself (pool seed seedFrom(0x6734, 12)).
  — The review asked that the man who lays the jug pour it; rejected: at the tamid the jug is laid by the second
  lottery's thirteenth and taken up by another man (G2/G3), so TuM 4:9 gives the musaf the same two men. — A fresh
  crew per lamb (two crews of nine; faster but against TuM 4:9).
- **The lambs are brought up the flight of Sha'ar HaKorban by two Levites and handed over just inside the gate,
  ~1¾ minutes before the window, so at its start (the jump-to-event) the lambs stand at the rings with the crew round
  them and the binding follows ~2 minutes later.** — Middot 1:5 names the gate; that the most-holy offerings (olot are
  kodshei kodashim) were brought in by it is the commentators' reading (report §03), and the caption says so. The
  lamb chamber of Beit HaMoked is the tamid's store (Arachin 2:5's six count the tamidim), and G2 owns its six lambs.
  ⚙ Levites as the handlers, the Mount as where the lambs were kept, the minutes. — From the lamb chamber (would empty
  G2's flock); handing over at the window's start (the jump landed on an empty slaughter area for 3 minutes).
- **Rings: two of the second row ([221, 351.5] — the event's pos — and [213, 351.5]); hooks on pillars 5 and 3;
  bound as the tamid (head south, face west), the slaughterer east of it; as G2's tamid, two kneel holding it from the
  north (hind legs, hindquarters) and the others stand 2½–3 amot back, so its head, face and the slaughterer stay
  open to the south-west.** ⚙ (Tamid 4:1 for the musaf). — Four kneeling round it (the review found them inside one
  another, hiding the lamb).
- **One lamb after the other: A slaughtered, A's blood thrown (NE, SW, the rest on the south base — Zevachim 5:4), then
  B slaughtered and its blood thrown; the slaughterer hangs each on its hook; flays A, then B.** — The receiver cannot
  hold two bloods (the mizrak has no flat base), and TuM 4:9 gives both lambs to the same men. Flaying windows of 8
  minutes each (the tamid's order of cuts at G2's fractions). — Both together with two crews.
- **The six bearers stand in a row at A's hook for its parts, carry them to the lower half of the ramp on its west side
  (Shekalim 8:8), come back for B's; the flour and wine men come from the chavitin chamber, lay theirs, and salt each
  lamb's parts (Menachot 21b's salt on the ramp).** ⚙ (G2's tamid staging for the musaf.)
- **The receiver takes his gold basin back to Lishkat HaKelim, then each hide to Lishkat HaParvah (not salted on
  Shabbat — the chamber's salting is weekday only).** ⚙
- **Up: each limbs man his part of A then of B; then the flour (the minchah of the nesachim, burned whole); then the
  wine at the south-west horn — up, left, and back "on his heels" (Zevachim 6:3).**
- **The song: `musafConcert(ctx, sim)` (g6/musaf.js — pure, cached per runtime generation, so module update order does
  not matter) gives libation-song the concert to stage: L0 (the first set on the table of the fats), tPour (= the
  cymbal), the ctx.audio.libation timeline (sets, blow, cym, ch, prost, end — as g3 libTimeline), t1, the wine jug on
  the ramp { at, laid, pick }, the pour spot and the Ha'azinu section. Until libation-song claims it (`claims:
  ['shabbat-musaf-song']` on its export, re-checked every update) this module stages only the two trumpeters (on the
  table of the fats, then at Ben Arza's right and left — Tamid 7:3) and plays ctx.audio.libation; once claimed it drops
  them, and its wine man leaves the jug on the ramp for libation-song's pourer.** — The brief: coordinate rather than
  duplicate the Levites. As built, libation-song (G3's ketoret-morning module) claims it: its Levites stay on the duchan
  for the musaf's song, its trumpeters, segan and pourer stage it and it plays the audio; it leaves the pour's caption
  to this module (`captions.pour = false`), which names the Ha'azinu section. The claim is re-checked every update
  because the runtime is not yet on ctx when modules are initialised.
- **Ha'azinu: six sections (RH 31a, הזי"ו ל"ך: 32:1, 7, 13, 19, 29, 40), one per Shabbat, counted in whole weeks from
  the Shabbat of 2026-01-03.** ⚙ The cycle's phase is not recorded. The audio has no Ha'azinu: Psalm 92's melody stands
  in with its caption suppressed; G6's caption names the section (requested from audio).
- **Nine blasts: the concert's three teki'ah-teru'ah-teki'ah sets (Sukkah 5:5 — "at the musafim they added nine").**
- **No Kohen Gadol at the musaf** (the event does not name him; G2 shows him at the tamid's limbs and wine).

## shabbat-showbread

- **The new bread comes from Beit Garmu's chamber in Beit HaMoked (Middot 1:6; Yoma 38a) to the marble table in the
  Ulam ~4 minutes before the change, carried by the four of the incoming who will bring it in.** — Menachot 11:7: "on
  the marble table they laid it as it came in"; something must put it there, so nothing pops onto the table. ⚙ when,
  and that the bowls of frankincense come with it. — The bread already on the table from dawn.
- **The eight: four takers-out go in first and stand on the south of the Shulchan facing north (two bowl-men in
  front, two stack-men 2 amot behind); four bringers-in follow and stand on the north facing south, between the table
  and the wall (two with the stacks in front, two with the bowls out past the table's corners — the wall is 2½ amot
  off).** — Menachot 11:7 / TuM 5:4: הַנִּכְנָסִין / הַיּוֹצְאִין there are the bringers-in and the takers-out, not the
  watches. ⚙ **That the bringers are of the incoming watch and the takers of the outgoing is a reconstruction:** the
  new week's bread is the incoming watch's service (the incoming do the bazichin and the afternoon tamid, Sukkah 56b),
  and at the division the incoming take the north "for they are ready for the service" (Sukkah 5:8; TuM 4:12) — the
  side the bringers-in stand on. The table is 1⅔ × ⅚ amot: rows of two, the second row stepping up in turn; the men
  who step aside go past the ends, ≥ 1.2 amot from the next man. ⚙ rows. — All eight of one watch.
- **Order: the old bowls lifted off; the stacks drawn out south (0.8 amah) as the new slide on from the north, both
  pairs at once over 0.8 min; the new bowls set on.** — "These draw and those lay down, the handbreadth of one beside the handbreadth
  of the other" (Menachot 11:7); R' Yosi's leniency not shown.
- **The old bread and bowls to the gold table in the Ulam (Menachot 11:7; Shekalim 6:4).**
- **bread-warm: the four who took it out stay by the gold table — on its south, south-east corner, north and
  north-east corner, ≥ 1.6 amot apart, facing it, its east side open to the Ulam's front; one lays his hands on the
  loaves (`semichah` clip); the two on its north step back before the frankincense is fetched. With the aggadah layer
  on, a faint, short wisp (0.35 m, intensity ≤ 0.45, density per puff scaled by the tier's puff count so high is no
  denser than low) rises from the loaves until they are taken; the caption cites Yoma 21a and Chagigah 26b.** — The
  event is aggadah: "shown subtly or not at all"; no glow. The first build's 0.7 m column read as a kettle plume on
  high. — Nothing visible.
- **bazichin: two of the incoming (the two who brought the new bowls) carry the old bowls up the ramp's east half, round
  the top to the right (Zevachim 6:3) to the incense pile at the south-west, salt the frankincense (Rambam TuM 4:10 —
  "the frankincense requires salt like the other offerings") and pour it on the coals; a white column rises; they finish
  the circuit to the ramp's head and go down its west half; the empty bowls back to Lishkat HaKelim ⚙.** — After the
  musafim (Abaye, Yoma 33a–34a; TuM 4:11), by the incoming (Sukkah 56b). The incense pile's eight se'ah (Tamid 2:5) is
  G2's pile; the caption names it.
- **The Shulchan's static bread stays while the carried stacks are shown (a moment of extra bread during the slide); a
  stand-in prop (`loaves_todah`) for a stack of six; the kanim are still in the static model on Shabbat.** — Requested
  from people (a stack prop) and build-heichal (a movable for the table's bread; the kanim pulled on Friday — Menachot
  11:6 / 97a).

## shabbat-mishmar

- **Six and six (the anonymous Mishnah; R' Yehudah's seven and five named in the schedule's text).**
- **After the frankincense is burned (Rambam TuM 4:10: the bread is not eaten before), the outgoing leader takes one
  stack from the gold table to the south of Ezrat Kohanim, the incoming leader the other to the north; fifteen of each
  watch stand in a horseshoe opening to the man holding the bread, each comes up in turn for his share (`kemitzah`,
  a handful into the palm) and eats where he stands; then back into Lishkat HaGazit by turns.** — Sukkah 5:8; TuM 4:12
  ("the incoming divide in the north, for they are ready for the service"). ⚙ the counts (the schedule's 30), the
  horseshoes, the leaders on the east side.
- **Two in each group do not come up: "the modest draw back their hands" — a share is a bean's worth since Shimon
  HaTzaddik (Yoma 39a).**
- **Bilgah (Sukkah 5:8; 56b): a caption at the south group; the sealed knife niche is the heichal builder's (south
  wing of the Beit HaChalifot); no ring is yet shown fixed (requested from build-altar).** Which mishmar serves a given
  week is not computed — the rotation's phase is not recorded. — A 24-week cycle anchored on Yehoyariv at 9 Av 3830.
- **The Kohen Gadol's half of every watch's loaves (TuM 4:14) is not shown** — no Kohen Gadol in this event.

## shabbat-eve

- **Two kohanim with silver trumpets come out of the Gazit, cross the court, climb the newel stair in the Water Gate's
  east room (barkai's way) and stand on the terrace: one on the walk by the mikveh's tank facing south-west (the Upper
  City), one on the stair's landing at its south parapet facing south over the well (the Ophel and the fields of the
  Kidron); teki'ah-teru'ah-teki'ah (`trumpet-set`) at t0 + 0.52; down and back in; up again for the second three, and
  down after sunset.** — Sukkah 5:5 counts the six; report §33.1's roof station; the schedule's Water Gate; Shabbat
  35b's baraita (the first blast for the fields, the second for the city). ⚙ the stair, the spots, the facings,
  staying 1½ min.
- **The view is on the terrace, at Beit Avtinas's door [216.3, 261.2, 36] heading 78 (requested).** From the court the
  terrace's parapet (2 amot as built by build-courts) hides all but their heads from every standing place — the court
  floor, the ramp, the altar top (shots fri-A-ramphead, high-friday-blasts-court); the Mount is lower still, and the
  mikveh's tank and Beit Avtinas close the terrace from the south. The roof is chol and reached by the stair the
  trumpeters use. — Staging them higher (Beit Avtinas's roof has no stair; the mikveh's steps are ⅓-amah treads at the
  Kohen Gadol's pool) or moving the station (the schedule's).

## Shabbat as a whole (checked, owned by others)

- No individuals' offerings on Shabbat (private-offerings: `no individual offerings today`), the Parvah's salting is
  weekday-only, no torches on Shabbat night (night-watch, torch-inspection, tamid-morning use none), the incoming and
  outgoing watches at the Gazit's blessing (gazit-shema) and the afternoon lottery (lotteries).

## Review fixes (choreo-g6-shabbat-fix)

- **Cost:** the peak was the division's 22 walkers coming out of the Gazit (a floor query each per frame). Their ways
  stay on the court's pavement, so their Scripts are `exact()` (authored Z, as G2's limbs-up men).
- **Sources:** Sha'ar HaKorban's use is the commentators' (report §03), not Middot 1:5; the watch assignment of the
  eight is marked ⚙ (above).
- **Spacing:** the four at the marble table had the gold table's crowding too (two 0.55 amah apart); they now stand on
  its north, east, south and south-east, ≥ 1.2 amot apart, facing it.
- **Rejected — "the man who lays the jug pours it":** see shabbat-musaf, first bullet. The default mode already has the
  morning's wine man (G3's brother 12) pour; the fallback now does too, and the flour goes up with the morning's
  fourth-lottery flour man.
